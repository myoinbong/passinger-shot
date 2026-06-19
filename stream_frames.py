import cv2
import sys
import argparse
import os

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", default="GMT20260618-070456_Recording_640x360.mp4")
    parser.add_argument("--interval", type=float, default=1.0)
    parser.add_argument("--max-duration", type=float, default=float('inf'))
    args = parser.parse_args()

    if not os.path.exists(args.video):
        print(f"Error: Video file {args.video} not found.", file=sys.stderr)
        sys.exit(1)

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        print("Error: Could not open video file.", file=sys.stderr)
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 25.0 # fallback

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps
    
    limit_duration = min(duration, args.max_duration)

    print(f"Streaming video: {args.video}", file=sys.stderr)
    print(f"FPS: {fps}, Duration: {duration:.2f}s (limited to {limit_duration:.2f}s), Interval: {args.interval}s", file=sys.stderr)

    # Frame step calculation
    frame_step = int(args.interval * fps)
    if frame_step < 1:
        frame_step = 1

    current_frame = 0
    while current_frame < frame_count:
        timestamp = current_frame / fps
        if timestamp > limit_duration:
            break

        cap.set(cv2.CAP_PROP_POS_FRAMES, current_frame)
        success, frame = cap.read()
        if not success:
            break

        # Preprocessing pipeline:
        # 1. Crop to screen
        ymin, ymax = 100, 240
        xmin, xmax = 240, 330
        crop = frame[ymin:ymax, xmin:xmax]

        # 2. Rotate 90 deg clockwise
        rotated = cv2.rotate(crop, cv2.ROTATE_90_CLOCKWISE)

        # 3. Crop just digits
        digits_crop = rotated[15:72, 32:125]

        # 4. Grayscale
        gray = cv2.cvtColor(digits_crop, cv2.COLOR_BGR2GRAY)

        # 5. Threshold
        _, thresh = cv2.threshold(gray, 120, 255, cv2.THRESH_BINARY)

        # 6. Resize 3x
        upscaled = cv2.resize(thresh, (0, 0), fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)

        # Encode to PNG in memory
        success_enc, png_bytes = cv2.imencode('.png', upscaled)
        if success_enc:
            data = png_bytes.tobytes()
            # Send frame header to stdout
            # Header format: FRAME_START\n<timestamp>\n<data_len>\n
            sys.stdout.buffer.write(b"FRAME_START\n")
            sys.stdout.buffer.write(f"{timestamp:.3f}\n".encode('ascii'))
            sys.stdout.buffer.write(f"{len(data)}\n".encode('ascii'))
            sys.stdout.buffer.write(data)
            sys.stdout.flush()

        current_frame += frame_step

    cap.release()
    print("Streaming finished.", file=sys.stderr)

if __name__ == "__main__":
    main()
