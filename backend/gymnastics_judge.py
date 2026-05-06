import math
from dataclasses import dataclass
from enum import Enum
from typing import List, Dict, Optional, Tuple
import time

class RoutineState(Enum):
    WAITING = 'waiting'
    SETUP = 'setup'
    ACTIVE = 'active'
    FINISHED = 'finished'

@dataclass
class Deduction:
    time: float
    reason: str
    amount: float
    score: float

@dataclass
class CircleDetectionState:
    mushroom_center_x: Optional[float] = None
    mushroom_center_y: Optional[float] = None
    last_foot_position: Optional[Dict] = None
    oscillation_state: str = 'center'
    last_circle_time: float = 0
    rotation_direction: Optional[str] = None
    step_sequence: List[str] = None
    last_direct_circle_time: float = 0

    def __post_init__(self):
        if self.step_sequence is None:
            self.step_sequence = []

@dataclass
class JudgeState:
    score: float = 10.0
    routine_state: RoutineState = RoutineState.WAITING
    routine_start_time: float = 0
    circle_count: int = 0
    waiting_for_salute: bool = False
    waiting_for_bow: bool = False
    gesture_hold_frames: int = 0
    baseline_center_x: Optional[float] = None
    has_stepped_off: bool = False
    step_off_grace_period: float = 0
    landing_position: Optional[Dict] = None
    last_step_check_time: float = 0
    last_deduction_time: float = 0
    pending_deductions: List[Dict] = None
    deduction_timestamps: List[Deduction] = None
    circle_state: CircleDetectionState = None
    window_step_count: int = 0
    dismount_frame_count: int = 0

    def __post_init__(self):
        if self.pending_deductions is None:
            self.pending_deductions = []
        if self.deduction_timestamps is None:
            self.deduction_timestamps = []
        if self.circle_state is None:
            self.circle_state = CircleDetectionState()

def calculate_angle(A: Dict, B: Dict, C: Dict) -> float:
    """Calculate angle between three points in degrees"""
    AB = {'x': B['x'] - A['x'], 'y': B['y'] - A['y']}
    CB = {'x': B['x'] - C['x'], 'y': B['y'] - C['y']}
    
    dot = AB['x'] * CB['x'] + AB['y'] * CB['y']
    mag_ab = math.hypot(AB['x'], AB['y'])
    mag_cb = math.hypot(CB['x'], CB['y'])
    
    if mag_ab == 0 or mag_cb == 0:
        return 180.0
        
    cos_angle = dot / (mag_ab * mag_cb)
    clamped_cos = max(-1.0, min(1.0, cos_angle))
    return math.degrees(math.acos(clamped_cos))

def distance(A: Dict, B: Dict) -> float:
    """Calculate Euclidean distance between two points"""
    return math.hypot(A['x'] - B['x'], A['y'] - B['y'])

def detect_salute(landmarks: List[Dict]) -> bool:
    """Detect salute gesture (one arm raised above shoulder)"""
    nose = landmarks[0]
    left_shoulder = landmarks[11]
    right_shoulder = landmarks[12]
    left_elbow = landmarks[13]
    right_elbow = landmarks[14]
    left_wrist = landmarks[15]
    right_wrist = landmarks[16]
    
    required = [nose, left_shoulder, right_shoulder, left_elbow, right_elbow, left_wrist, right_wrist]
    if any(not lm or lm.get('visibility', 1.0) < 0.5 for lm in required):
        return False
        
    left_raised = (left_wrist['y'] < left_shoulder['y'] - 0.08 and left_elbow['y'] < left_shoulder['y'] - 0.04) or (left_wrist['y'] < (nose['y'] + 0.05))
    right_raised = (right_wrist['y'] < right_shoulder['y'] - 0.08 and right_elbow['y'] < right_shoulder['y'] - 0.04) or (right_wrist['y'] < (nose['y'] + 0.05))
    
    return left_raised or right_raised

def detect_bow(landmarks: List[Dict]) -> bool:
    """Detect bow gesture for routine end"""
    nose = landmarks[0]
    left_shoulder = landmarks[11]
    right_shoulder = landmarks[12]
    left_hip = landmarks[23]
    right_hip = landmarks[24]
    
    required = [nose, left_shoulder, right_shoulder, left_hip, right_hip]
    if any(not lm or lm.get('visibility', 1.0) < 0.4 for lm in required):
        return False
        
    shoulder_y = (left_shoulder['y'] + right_shoulder['y']) / 2
    head_drop = nose['y'] - shoulder_y
    bowing_down = head_drop > 0.04
    
    left_wrist = landmarks[15]
    right_wrist = landmarks[16]
    left_elbow = landmarks[13]
    right_elbow = landmarks[14]
    
    arms_at_sides = True
    if left_wrist and right_wrist and left_elbow and right_elbow:
        left_arm_reaching = left_wrist['y'] > left_shoulder['y'] + 0.3
        right_arm_reaching = right_wrist['y'] > right_shoulder['y'] + 0.3
        left_elbow_reaching = left_elbow['y'] > left_shoulder['y'] + 0.25
        right_elbow_reaching = right_elbow['y'] > right_shoulder['y'] + 0.25
        
        obvious_reaching = (left_arm_reaching and left_elbow_reaching) or (right_arm_reaching and right_elbow_reaching)
        arms_at_sides = not obvious_reaching
    
    return bowing_down and arms_at_sides

def evaluate_step_severity(movement_distance: float) -> float:
    """Evaluate step severity for landing deductions"""
    move_percent = movement_distance * 100
    if move_percent <= 3:
        return 0.0
    if move_percent <= 8:
        return 0.1
    if move_percent <= 15:
        return 0.2
    return 0.3

def detect_legs_apart(landmarks: List[Dict], hip_distance: float, ankle_dist: float, knee_dist: float) -> bool:
    """Detect if legs are apart beyond allowed threshold"""
    ankle_ratio = ankle_dist / hip_distance
    knee_ratio = knee_dist / hip_distance
    
    return (ankle_ratio > 1.4) or (knee_ratio > 1.5) or (ankle_dist > 0.25)

class GymnasticsJudge:
    def __init__(self):
        self.state = JudgeState()
        
    def reset_routine(self):
        """Reset all state for new routine"""
        self.state = JudgeState()
        
    def start_setup_mode(self):
        """Enter setup mode waiting for salute"""
        self.state.routine_state = RoutineState.SETUP
        self.state.waiting_for_salute = True
        self.state.waiting_for_bow = False
        self.state.gesture_hold_frames = 0
        
    def start_routine(self):
        """Start active routine mode"""
        self.state.routine_state = RoutineState.ACTIVE
        self.state.routine_start_time = time.time()
        self.state.score = 10.0
        self.state.circle_count = 0
        self.state.waiting_for_salute = False
        self.state.waiting_for_bow = True
        self.state.deduction_timestamps = []
        self.state.baseline_center_x = None
        self.state.has_stepped_off = False
        self.state.circle_state = CircleDetectionState()
        self.state.window_step_count = 0
        
    def end_routine(self):
        """End routine and finish scoring"""
        self.state.routine_state = RoutineState.FINISHED
        self.state.waiting_for_bow = False
        
    def process_frame(self, landmarks: List[Dict]) -> Dict:
        """Process a single frame of pose landmarks"""
        now = time.time()
        results = {
            'pose_status': 'tracking',
            'score': self.state.score,
            'circle_count': self.state.circle_count,
            'routine_state': self.state.routine_state.value,
            'deductions': [],
            'events': []
        }
        
        if not landmarks:
            results['pose_status'] = 'no_landmarks'
            return results
            
        # Extract key landmarks
        left_hip = landmarks[23]
        right_hip = landmarks[24]
        left_knee = landmarks[25]
        right_knee = landmarks[26]
        left_ankle = landmarks[27]
        right_ankle = landmarks[28]
        
        required_landmarks = [left_hip, right_hip, left_knee, right_knee, left_ankle, right_ankle]
        if any(not lm or lm.get('visibility', 0) < 0.5 for lm in required_landmarks):
            results['pose_status'] = 'low_confidence'
            return results
            
        # Gesture detection
        if self.state.routine_state == RoutineState.SETUP and self.state.waiting_for_salute:
            if detect_salute(landmarks):
                self.state.gesture_hold_frames += 1
                if self.state.gesture_hold_frames >= 1:
                    self.start_routine()
                    results['events'].append('salute_detected')
                    results['pose_status'] = 'salute_detected'
            else:
                self.state.gesture_hold_frames = 0
                results['pose_status'] = 'waiting_salute'
                
        elif self.state.routine_state == RoutineState.ACTIVE and self.state.waiting_for_bow:
            if detect_bow(landmarks):
                self.end_routine()
                results['events'].append('bow_detected')
                results['pose_status'] = 'routine_complete'
            else:
                results['pose_status'] = 'routine_active'
                
        # Calculate measurements
        left_knee_angle = calculate_angle(left_hip, left_knee, left_ankle)
        right_knee_angle = calculate_angle(right_hip, right_knee, right_ankle)
        
        hip_distance = distance(left_hip, right_hip)
        ankle_dist = distance(left_ankle, right_ankle)
        knee_dist = distance(left_knee, right_knee)
        
        # Active routine deductions
        if self.state.routine_state == RoutineState.ACTIVE:
            has_bending = False
            has_spreading = False
            
            # Check bending
            knee_threshold = 120
            left_bend = max(0, knee_threshold - left_knee_angle)
            right_bend = max(0, knee_threshold - right_knee_angle)
            has_bending = max(left_bend, right_bend) > 3
            
            # Check spreading
            ankle_ratio = ankle_dist / hip_distance
            knee_ratio = knee_dist / hip_distance
            ankle_spread = max(0, ankle_ratio - 1.0)
            knee_spread = max(0, knee_ratio - 1.0)
            has_spreading = max(ankle_spread, knee_spread) > 0.2
            
            if has_bending or has_spreading:
                self._apply_deduction(has_bending, has_spreading, now)
                
        return results
        
    def _apply_deduction(self, has_bending: bool, has_spreading: bool, now: float):
        """Apply deduction with grouping logic"""
        video_time = now - self.state.routine_start_time
        time_since_last = now - self.state.last_deduction_time
        
        if time_since_last <= 0.3 and self.state.pending_deductions:
            existing = self.state.pending_deductions[-1]
            if has_bending:
                existing['bending'] = True
            if has_spreading:
                existing['spreading'] = True
            existing['time'] = video_time
        else:
            self.state.pending_deductions.append({
                'bending': has_bending,
                'spreading': has_spreading,
                'time': video_time,
                'applied': False
            })
            
            # Schedule deduction after delay
            import threading
            timer = threading.Timer(0.3, self._process_pending_deduction)
            timer.daemon = True
            timer.start()
            
        self.state.last_deduction_time = now
        
    def _process_pending_deduction(self):
        """Process pending deduction after grouping delay"""
        if not self.state.pending_deductions:
            return
            
        deduction = self.state.pending_deductions[-1]
        if deduction['applied']:
            return
            
        deduction['applied'] = True
        
        amount = 0.0
        reason = ""
        
        if deduction['bending'] and deduction['spreading']:
            amount = 0.2
            reason = "Bending and spreading"
        elif deduction['bending']:
            amount = 0.1
            reason = "Leg bending"
        elif deduction['spreading']:
            amount = 0.1
            reason = "Legs spread"
            
        if amount > 0:
            self.state.score = max(5.0, self.state.score - amount)
            
            adjusted_time = max(0, deduction['time'] - 0.2)
            self.state.deduction_timestamps.append(Deduction(
                time=adjusted_time,
                reason=reason,
                amount=amount,
                score=self.state.score
            ))