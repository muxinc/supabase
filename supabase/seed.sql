-- Seed data for workflow_executions table

-- Insert some test workflow executions
INSERT INTO workflow_executions (
  message_id,
  workflow_name,
  status,
  created_at,
  started_at,
  completed_at,
  execution_time_ms,
  retry_count,
  event_data,
  result_data
) VALUES 
  -- Completed workflows
  (1001, 'process-video', 'completed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 55 minutes', 300000, 0, 
   '{"video_id": "vid_123", "duration": 120}', '{"output": "processed_vid_123.mp4"}'),
  
  (1002, 'transcode-audio', 'completed', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 50 minutes', 600000, 1,
   '{"audio_id": "aud_456", "format": "mp3"}', '{"output": "transcoded_aud_456.mp3"}'),
  
  -- Processing workflows
  (1003, 'generate-thumbnails', 'processing', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', NULL, NULL, 0,
   '{"video_id": "vid_789", "count": 5}', '{}'),
  
  (1004, 'process-video', 'processing', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes', NULL, NULL, 0,
   '{"video_id": "vid_234", "duration": 240}', '{}'),
  
  -- Failed workflows
  (1005, 'transcode-audio', 'failed', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 45 minutes', 900000, 3,
   '{"audio_id": "aud_999", "format": "flac"}', '{}'),
  
  (1006, 'generate-thumbnails', 'failed', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 55 minutes', 300000, 2,
   '{"video_id": "vid_888", "count": 10}', '{}'),
  
  -- Pending workflows
  (1007, 'process-video', 'pending', NOW() - INTERVAL '5 minutes', NULL, NULL, NULL, 0,
   '{"video_id": "vid_345", "duration": 180}', '{}'),
  
  (1008, 'transcode-audio', 'pending', NOW() - INTERVAL '2 minutes', NULL, NULL, NULL, 0,
   '{"audio_id": "aud_567", "format": "wav"}', '{}'),
  
  -- Shutdown interrupted workflow
  (1009, 'process-video', 'shutdown_interrupted', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours 30 minutes', 1800000, 1,
   '{"video_id": "vid_111", "duration": 600}', '{}'),
  
  -- More completed workflows for variety
  (1010, 'generate-thumbnails', 'completed', NOW() - INTERVAL '7 hours', NOW() - INTERVAL '7 hours', NOW() - INTERVAL '6 hours 58 minutes', 120000, 0,
   '{"video_id": "vid_222", "count": 3}', '{"thumbnails": ["thumb1.jpg", "thumb2.jpg", "thumb3.jpg"]}');

-- Update some records with error details for failed workflows
UPDATE workflow_executions 
SET 
  error_message = 'Failed to transcode audio: unsupported format',
  error_details = '{"error_code": "UNSUPPORTED_FORMAT", "details": "FLAC format not supported in current configuration"}'
WHERE message_id = 1005;

UPDATE workflow_executions 
SET 
  error_message = 'Thumbnail generation failed: video file not found',
  error_details = '{"error_code": "FILE_NOT_FOUND", "path": "/videos/vid_888.mp4"}'
WHERE message_id = 1006;

UPDATE workflow_executions 
SET 
  shutdown_detected_at = NOW() - INTERVAL '5 hours 30 minutes',
  shutdown_reason = 'timeout',
  error_message = 'Process interrupted due to function timeout'
WHERE message_id = 1009;

-- Update heartbeats for processing workflows
UPDATE workflow_executions 
SET last_heartbeat = NOW() - INTERVAL '1 minute'
WHERE status = 'processing';