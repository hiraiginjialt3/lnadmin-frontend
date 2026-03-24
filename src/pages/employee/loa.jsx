import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const LeaveOfAbsencePage = () => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [leaveType, setLeaveType] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Basic validation
    if (!startDate || !leaveType) {
      alert("Please select a date and leave type.");
      return;
    }

    const leaveData = {
      startDate,
      endDate,
      leaveType,
      reason,
      file,
    };

    console.log("Leave Submitted:", leaveData);
    alert("Your leave request has been submitted!");
    // TODO: send leaveData to backend API
  };

  return (
    <div className="container my-4">

      <h1 className="fw-bold mb-4">Leave of Absence Request</h1>

      <div className="card shadow-sm p-4">
        <form onSubmit={handleSubmit}>

          {/* ================= DATE PICKER ================= */}
          <div className="mb-3">
            <label className="form-label fw-bold">Select Date(s) of Leave</label>
            <div className="d-flex gap-2">
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                placeholderText="Start Date"
                className="form-control"
                dateFormat="MMMM d, yyyy"
              />
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                placeholderText="End Date (optional)"
                className="form-control"
                dateFormat="MMMM d, yyyy"
              />
            </div>
          </div>

          {/* ================= LEAVE TYPE ================= */}
          <div className="mb-3">
            <label className="form-label fw-bold">Leave Type</label>
            <select
              className="form-select"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              required
            >
              <option value="">Select leave type</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Personal Leave">Personal Leave</option>
              <option value="Emergency Leave">Emergency Leave</option>
              <option value="Vacation Leave">Vacation Leave</option>
            </select>
          </div>

          {/* ================= REASON ================= */}
          <div className="mb-3">
            <label className="form-label fw-bold">Reason (optional)</label>
            <textarea
              className="form-control"
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain your absence..."
            />
          </div>

          {/* ================= UPLOAD LETTER ================= */}
          <div className="mb-3">
            <label className="form-label fw-bold">Upload Leave Letter (optional)</label>
            <input
              type="file"
              className="form-control"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Submit Leave Request
          </button>
        </form>
      </div>

      {/* ================= OPTIONAL: SHOW PAST LEAVES ================= */}
      <div className="mt-5">
        <h4 className="fw-bold mb-3">Your Previous Leaves</h4>
        <table className="table table-bordered shadow-sm">
          <thead className="table-light">
            <tr>
              <th>Date(s)</th>
              <th>Leave Type</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Feb 12 - Feb 14, 2025</td>
              <td>Sick Leave</td>
              <td>Flu</td>
              <td><span className="badge bg-success">Approved</span></td>
            </tr>
            <tr>
              <td>Mar 5, 2025</td>
              <td>Personal Leave</td>
              <td>Family Errand</td>
              <td><span className="badge bg-warning text-dark">Pending</span></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default LeaveOfAbsencePage;
