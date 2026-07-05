# Pack Your Jeju API — Railway 배포용
# 3.11-slim + psycopg[binary] + fastapi + uvicorn. 이미지 크기 최소화.
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# 한글 폰트 (reportlab PDF 생성에 사용).
#  - fonts-nanum: NanumGothic.ttf는 순수 TTF라 reportlab이 완벽 파싱 (주 폰트).
#  - fonts-noto-cjk: TTC 파일로 배포되나 reportlab이 postscript outlines를 못 다뤄
#    실패 사례가 있음. 백업으로만 둔다.
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-nanum \
    && rm -rf /var/lib/apt/lists/*

# 의존성만 먼저 설치 (레이어 캐시 활용)
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

# 앱 소스
COPY apps ./apps
COPY packages ./packages

# Railway는 PORT 환경변수를 주입한다. 기본 8000.
ENV PORT=8000
EXPOSE 8000

# 시작: FastAPI 앱 실행 (uvicorn)
CMD ["sh", "-c", "uvicorn apps.api.main:app --host 0.0.0.0 --port ${PORT}"]
