"""로컬 API 부팅 (개발자용).

`python -m uvicorn ...` 대신 여기서 임포트해 실행하면
CWD가 sys.path의 첫 항목이라 `apps` 패키지가 즉시 잡힌다.
"""
import os
import sys
import uvicorn

# 부모(=repo root) 경로를 sys.path에 확실히 넣어 apps.* 임포트 보장.
_here = os.path.dirname(os.path.abspath(__file__))
_root = os.path.dirname(_here)
if _root not in sys.path:
    sys.path.insert(0, _root)

if __name__ == "__main__":
    uvicorn.run(
        "apps.api.main:app",
        host="0.0.0.0",
        port=8000,
        log_level="warning",
    )
