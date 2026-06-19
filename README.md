# Video Sensor OCR Pipeline (동영상 센서 화면 OCR 데이터 추출기)

이 프로젝트는 동영상 내의 무게/수치 센서 화면을 자동으로 크롭, 보정(회전, 이진화, 확대)하고 OCR을 수행하여 시간에 따른 센서 데이터 변화를 CSV 파일로 추출하는 도구입니다.

디스크 쓰기 낭비 없이 **인메모리 스트리밍 파이프라인**을 사용하여 3시간이 넘는 분량의 비디오를 단 2분 만에 빠르게 분석할 수 있습니다.

---

## 🛠️ 요구 사양 (Prerequisites)

- **OS**: Linux (Ubuntu 등) 또는 Windows WSL2
- **Python**: 3.10 이상
- **Node.js**: v18.0.0 이상 (npm 포함)

---

## 📥 설치 방법 (Installation)

### 1. 파이썬 가상환경 구성 및 패키지 설치
패키지 간 충돌을 방지하기 위해 가상환경을 생성하고 필요한 패키지(`opencv-python`, `Pillow`, `numpy`)를 설치합니다.

```bash
# 가상환경 생성
python3 -m venv .venv

# pip 업그레이드 및 필수 파이썬 패키지 설치
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install opencv-python Pillow numpy
```

### 2. Node.js 의존성 패키지 설치
OCR 엔진인 `Tesseract.js`를 설치합니다.

```bash
npm install
```
> **참고**: 처음 실행 시 `tesseract.js`가 영어 학습용 데이터(`eng.traineddata`, 약 4MB)를 다운로드하기 위해 인터넷 연결이 필요하며, 이후에는 캐시된 데이터를 사용하여 오프라인으로 실행됩니다.

---

## 🚀 사용 방법 (Usage)

### 1. (선택) 센서 화면 위치 좌표 찾기
새로운 각도의 영상을 분석할 때, 센서 화면이 위치한 좌표를 찾기 위해 특정 시점의 프레임을 단일 이미지로 추출합니다.

```bash
# 기본값으로 5초 시점의 프레임을 sample.png로 추출합니다.
./.venv/bin/python3 extract_sample.py
```
*생성된 `sample.png`를 이미지 뷰어로 열어 분석하려는 센서 사각형 영역의 픽셀 좌표(ymin, ymax, xmin, xmax)를 파악합니다.*

### 2. OCR 파이프라인 실행
스트리밍 파이프라인을 실행하여 전체 비디오를 분석하고 결과를 CSV로 저장합니다.

```bash
# 기본 실행 (2초 간격 분석, 4개 스레드 병렬 처리)
node ocr_pipeline.js

# 커스텀 옵션 실행 예시 (1초 간격 분석, 6개 스레드 사용)
node ocr_pipeline.js --interval 1.0 --workers 6
```

#### CLI 옵션 안내:
- `-i`, `--interval <초>`: 분석할 프레임의 간격 (기본값: `2.0`초)
- `-w`, `--workers <개수>`: 병렬로 실행할 OCR 워커 스레드 수 (기본값: `4`개)
- `-d`, `--max-duration <초>`: 영상의 시작부터 지정한 초 분량까지만 제한하여 테스트 분석 (예: `--max-duration 60.0` 입력 시 첫 1분만 분석)

---

## 📊 결과물 (Output)

분석이 완료되면 실행 경로에 **`sensor_data.csv`** 파일이 생성됩니다.

```csv
Timestamp (s),Time Format (HH:MM:SS),Value
0.000,00:00:00,
2.000,00:00:02,5578.0
4.000,00:00:04,5578.0
...
11604.000,03:13:24,47910
```

- **Timestamp (s)**: 영상의 절대 시간(초)
- **Time Format**: `HH:MM:SS` 형식의 재생 시간
- **Value**: 추출된 센서 숫자값 (소수점 포함)

---

## ⚙️ 화면 크롭 및 보정 좌표 수정 방법

카메라의 위치나 센서 화면의 크기가 바뀐 경우, `stream_frames.py` 파일 내의 아래 좌표 변수들을 수정해야 합니다.

```python
# stream_frames.py 파일 내 ymin, ymax, xmin, xmax 영역 수정

# 1. 원본 해상도(640x360) 기준 대략적인 센서 장치 화면 영역 크롭
ymin, ymax = 100, 240
xmin, xmax = 240, 330

# 2. 회전된 장치 화면 내에서 순수 숫자 영역만 크롭 (가로 140px, 세로 90px 기준)
digits_crop = rotated[15:72, 32:125]
```
