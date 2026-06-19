import cv2
import sys
import os

def main():
    video_path = "GMT20260618-070456_Recording_640x360.mp4"
    if not os.path.exists(video_path):
        print(f"Error: Video file {video_path} not found.")
        sys.exit(1)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error: Could not open video file.")
        sys.exit(1)

    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = frame_count / fps if fps > 0 else 0

    print(f"Video Width: {width}px")
    print(f"Video Height: {height}px")
    print(f"Video FPS: {fps}")
    print(f"Total Frames: {frame_count}")
    print(f"Duration: {duration:.2f} seconds")

    # Seek to t = 5.0 seconds
    target_time_s = 5.0
    if target_time_s > duration:
        target_time_s = duration / 2.0
    
    frame_num = int(target_time_s * fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
    
    success, frame = cap.read()
    if not success:
        print(f"Error: Could not read frame at {target_time_s} seconds.")
        sys.exit(1)

    output_path = "sample.png"
    cv2.imwrite(output_path, frame)
    print(f"Successfully saved sample frame to {os.path.abspath(output_path)}")
    
    cap.release()

if __name__ == "__main__":
    main()
