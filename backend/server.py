from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from gymnastics_judge import GymnasticsJudge, Deduction

app = FastAPI(title="Gymnastics Judge API")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

judge = GymnasticsJudge()

class LandmarkRequest(BaseModel):
    landmarks: List[Dict]

class ProcessResponse(BaseModel):
    pose_status: str
    score: float
    circle_count: int
    routine_state: str
    deductions: List[Dict]
    events: List[str]

@app.post("/api/process-frame", response_model=ProcessResponse)
async def process_frame(request: LandmarkRequest):
    """Process a single frame of pose landmarks"""
    try:
        result = judge.process_frame(request.landmarks)
        
        # Convert Deduction objects to dicts
        result['deductions'] = [
            {
                'time': d.time,
                'reason': d.reason,
                'amount': d.amount,
                'score': d.score
            }
            for d in judge.state.deduction_timestamps
        ]
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/start-setup")
async def start_setup():
    """Enter setup mode waiting for salute"""
    judge.start_setup_mode()
    return {"status": "ok", "message": "Setup mode activated"}

@app.post("/api/reset-routine")
async def reset_routine():
    """Reset all state for new routine"""
    judge.reset_routine()
    return {"status": "ok", "message": "Routine reset"}

@app.get("/api/score")
async def get_score():
    """Get current score"""
    return {"score": judge.state.score}

@app.get("/api/deductions")
async def get_deductions():
    """Get all deduction timestamps"""
    return [
        {
            'time': d.time,
            'reason': d.reason,
            'amount': d.amount,
            'score': d.score
        }
        for d in judge.state.deduction_timestamps
    ]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")