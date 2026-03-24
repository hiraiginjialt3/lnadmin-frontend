import React, { useState, useRef } from 'react';
import { recognizeFace, clockIn, clockOut } from '../services/api';
import Webcam from 'react-webcam';

const FaceRecognition = () => {
  const [recognizedEmployee, setRecognizedEmployee] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const webcamRef = useRef(null);

  const captureAndRecognize = async () => {
    setLoading(true);
    setMessage('');
    setRecognizedEmployee(null);

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        setMessage('Cannot capture image. Please allow camera access.');
        setLoading(false);
        return;
      }

      const blob = await fetch(imageSrc).then(res => res.blob());
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });

      const response = await recognizeFace(file);
      
      if (response.data.success && response.data.recognized) {
        setRecognizedEmployee({
          id: response.data.employee_id,
          name: response.data.employee_name
        });
        setMessage(`Welcome ${response.data.employee_name}!`);
      } else {
        setMessage(response.data.message || 'Face not recognized');
      }
    } catch (error) {
      setMessage('Error recognizing face');
      console.error('Recognition error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!recognizedEmployee) return;
    
    try {
      const response = await clockIn(recognizedEmployee.id);
      if (response.data.success) {
        setMessage(`Clocked in successfully at ${response.data.time}`);
      }
    } catch (error) {
      setMessage('Error clocking in');
      console.error('Clock in error:', error);
    }
  };

  const handleClockOut = async () => {
    if (!recognizedEmployee) return;
    
    try {
      const response = await clockOut(recognizedEmployee.id);
      if (response.data.success) {
        setMessage(`Clocked out successfully. Worked ${response.data.work_hours} hours`);
        setRecognizedEmployee(null);
      }
    } catch (error) {
      setMessage('Error clocking out');
      console.error('Clock out error:', error);
    }
  };

  return (
    <div className="container py-4">
      <h2>Face Recognition Attendance</h2>
      <div className="row">
        <div className="col-md-6">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            style={{ width: '100%' }}
          />
          <button className="btn btn-primary mt-3" onClick={captureAndRecognize} disabled={loading}>
            {loading ? 'Recognizing...' : 'Capture & Recognize'}
          </button>
        </div>
        <div className="col-md-6">
          {message && <div className="alert alert-info">{message}</div>}
          {recognizedEmployee && (
            <div>
              <h4>Employee: {recognizedEmployee.name}</h4>
              <button className="btn btn-success me-2" onClick={handleClockIn}>Clock In</button>
              <button className="btn btn-danger" onClick={handleClockOut}>Clock Out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceRecognition;