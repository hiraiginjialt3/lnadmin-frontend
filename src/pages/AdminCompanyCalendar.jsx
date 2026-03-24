import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import axios from "axios";

const CompanyCalendar = () => {
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [companyEvents, setCompanyEvents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState("calendar"); // "calendar", "add-holiday", "add-event", "settings"
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  
  // Get current year dynamically
  const currentYear = new Date().getFullYear();
  
  // New holiday form
  const [newHoliday, setNewHoliday] = useState({
    name: "",
    date: "",
    type: "regular",
    description: ""
  });

  // New event form
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    type: "company-event",
    description: ""
  });

  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchHolidays(),
      fetchCompanyEvents(),
      fetchSettings()
    ]);
    setLoading(false);
  };

  // Fetch holidays from MongoDB
  const fetchHolidays = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/calendar/holidays");
      if (response.data.success) {
        setHolidays(response.data.holidays);
        
        // Add to calendar events
        const holidayEvents = response.data.holidays.map(holiday => ({
          id: holiday._id,
          title: `🇵🇭 ${holiday.name}`,
          date: holiday.date,
          color: holiday.color,
          borderColor: holiday.color,
          textColor: "#fff",
          extendedProps: { 
            type: "holiday",
            holidayType: holiday.type
          }
        }));
        setEvents(prev => [...prev.filter(e => e.extendedProps?.type !== "holiday"), ...holidayEvents]);
      }
    } catch (error) {
      console.error("Failed to fetch holidays:", error);
    }
  };

  // Fetch company events from MongoDB
  const fetchCompanyEvents = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/calendar/events");
      if (response.data.success) {
        setCompanyEvents(response.data.events);
        
        // Add to calendar events
        const eventItems = response.data.events.map(event => ({
          id: event._id,
          title: event.title,
          date: event.date,
          color: event.color,
          borderColor: event.color,
          textColor: "#fff",
          extendedProps: { 
            type: "event",
            eventType: event.type
          }
        }));
        setEvents(prev => [...prev.filter(e => e.extendedProps?.type !== "event"), ...eventItems]);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  };

  // Fetch settings from MongoDB
  const fetchSettings = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/attendance/settings");
      if (response.data.success) {
        setSettings(response.data.settings);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  // Save settings
  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:5000/api/attendance/settings",
        settings
      );
      if (response.data.success) {
        setMessage({ type: "success", text: "Settings saved successfully!" });
        setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      }
    } catch (error) {
      setMessage({ type: "danger", text: "Error saving settings" });
    } finally {
      setLoading(false);
    }
  };

  // Save new holiday
  const saveHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) {
      setMessage({ type: "danger", text: "Holiday name and date are required!" });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("http://localhost:5000/api/calendar/holidays", newHoliday);
      if (response.data.success) {
        await fetchHolidays(); // Refresh holidays
        setNewHoliday({ name: "", date: "", type: "regular", description: "" });
        setActiveTab("calendar");
        setMessage({ type: "success", text: "Holiday added successfully!" });
        setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      }
    } catch (error) {
      setMessage({ type: "danger", text: error.response?.data?.message || "Failed to add holiday" });
    } finally {
      setLoading(false);
    }
  };

  // Save new event
  const saveEvent = async () => {
    if (!newEvent.title || !newEvent.date) {
      setMessage({ type: "danger", text: "Event title and date are required!" });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("http://localhost:5000/api/calendar/events", newEvent);
      if (response.data.success) {
        await fetchCompanyEvents(); // Refresh events
        setNewEvent({ title: "", date: "", type: "company-event", description: "" });
        setActiveTab("calendar");
        setMessage({ type: "success", text: "Event added successfully!" });
        setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      }
    } catch (error) {
      setMessage({ type: "danger", text: "Failed to add event" });
    } finally {
      setLoading(false);
    }
  };

  // Delete holiday
  const deleteHoliday = async (holidayId) => {
    if (!window.confirm("Delete this holiday?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/calendar/holidays/${holidayId}`);
      await fetchHolidays(); // Refresh
      setMessage({ type: "success", text: "Holiday deleted!" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      setMessage({ type: "danger", text: "Failed to delete holiday" });
    }
  };

  // Delete event
  const deleteEvent = async (eventId) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/calendar/events/${eventId}`);
      await fetchCompanyEvents(); // Refresh
      setMessage({ type: "success", text: "Event deleted!" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      setMessage({ type: "danger", text: "Failed to delete event" });
    }
  };

  // Settings handlers
  const handleSettingChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleWorkDayToggle = (day) => {
    setSettings(prev => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter(d => d !== day)
        : [...prev.work_days, day]
    }));
  };

  // Holiday types
  const holidayTypes = [
    { value: "regular", label: "Regular Holiday", color: "#dc3545" },
    { value: "special", label: "Special Holiday", color: "#fd7e14" },
    { value: "special_non_working", label: "Special Non-Working", color: "#ffc107" }
  ];

  // Event types
  const eventTypes = [
    { value: "company-event", label: "Company Event", color: "#0d6efd" },
    { value: "meeting", label: "Meeting", color: "#fd7e14" },
    { value: "deadline", label: "Deadline", color: "#dc3545" },
    { value: "training", label: "Training", color: "#198754" },
    { value: "birthday", label: "Birthday", color: "#ff69b4" }
  ];

  return (
    <div className="container-fluid py-4">
      {/* Header - Updated with dynamic year and consistent format */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">Company Calendar {currentYear}</h4>
          <small className="text-muted">Manage holidays, events, and attendance settings</small>
        </div>
        <div className="btn-group">
          <button
            className={`btn ${activeTab === "calendar" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setActiveTab("calendar")}
          >
            📅 Calendar
          </button>
          <button
            className={`btn ${activeTab === "add-holiday" ? "btn-danger" : "btn-outline-danger"}`}
            onClick={() => setActiveTab("add-holiday")}
          >
            🇵🇭 Add Holiday
          </button>
          <button
            className={`btn ${activeTab === "add-event" ? "btn-success" : "btn-outline-success"}`}
            onClick={() => setActiveTab("add-event")}
          >
            🎉 Add Event
          </button>
          <button
            className={`btn ${activeTab === "settings" ? "btn-warning" : "btn-outline-warning"}`}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {/* Message Alert */}
      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible fade show mb-4`}>
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ type: "", text: "" })} />
        </div>
      )}

      {/* Current Settings Bar - UPDATED with standard work hours */}
      {settings && activeTab !== "settings" && (
        <div className="card bg-light mb-4">
          <div className="card-body py-2">
            <div className="row">
              <div className="col-md-2">
                <small className="text-muted">Shift:</small>
                <strong className="ms-2">{settings.clock_in_start} - {settings.clock_out_end}</strong>
              </div>
              <div className="col-md-2">
                <small className="text-muted">Work Day:</small>
                <strong className="ms-2 text-primary">{settings.standard_work_hours || 8} hours</strong>
              </div>
              <div className="col-md-2">
                <small className="text-muted">Grace Period:</small>
                <strong className="ms-2">{settings.grace_period_minutes} min</strong>
              </div>
              <div className="col-md-2">
                <small className="text-muted">Late After:</small>
                <strong className="ms-2">{settings.late_threshold}</strong>
              </div>
              <div className="col-md-2">
                <small className="text-muted">Break:</small>
                <strong className="ms-2">{settings.break_start} - {settings.break_end}</strong>
              </div>
              <div className="col-md-2">
                <small className="text-muted">OT Rate:</small>
                <strong className="ms-2">{settings.overtime_rate}x</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD HOLIDAY TAB */}
      {activeTab === "add-holiday" && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-danger text-white">
            <h5 className="mb-0">🇵🇭 Add New Holiday</h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Holiday Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Eid'l Fitr"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({...newHoliday, name: e.target.value})}
                />
              </div>
              <div className="col-md-3 mb-3">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})}
                />
              </div>
              <div className="col-md-3 mb-3">
                <label className="form-label">Holiday Type</label>
                <select
                  className="form-select"
                  value={newHoliday.type}
                  onChange={(e) => setNewHoliday({...newHoliday, type: e.target.value})}
                >
                  {holidayTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2 mb-3 d-flex align-items-end">
                <button
                  className="btn btn-danger w-100"
                  onClick={saveHoliday}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Holiday"}
                </button>
              </div>
            </div>
            <div className="row">
              <div className="col-12">
                <label className="form-label">Description (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Additional details about the holiday"
                  value={newHoliday.description}
                  onChange={(e) => setNewHoliday({...newHoliday, description: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD EVENT TAB */}
      {activeTab === "add-event" && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-success text-white">
            <h5 className="mb-0">🎉 Add New Event</h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Event Title</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Company Meeting"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                />
              </div>
              <div className="col-md-3 mb-3">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                />
              </div>
              <div className="col-md-3 mb-3">
                <label className="form-label">Event Type</label>
                <select
                  className="form-select"
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}
                >
                  {eventTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2 mb-3 d-flex align-items-end">
                <button
                  className="btn btn-success w-100"
                  onClick={saveEvent}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Event"}
                </button>
              </div>
            </div>
            <div className="row">
              <div className="col-12">
                <label className="form-label">Description (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Additional details about the event"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                />
              </div>
            </div>
            <div className="mt-2">
              <small className="text-muted">💡 Tip: Click any date on the calendar to auto-fill</small>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS TAB - UPDATED with Standard Work Hours */}
      {activeTab === "settings" && settings && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-warning text-dark">
            <h5 className="mb-0">⚙️ Attendance Settings</h5>
          </div>
          <div className="card-body">
            <div className="row">
              {/* Clock Times */}
              <div className="col-md-6 mb-4">
                <h6 className="border-bottom pb-2">🕒 Clock Times</h6>
                <div className="row">
                  <div className="col-6 mb-3">
                    <label className="form-label">Clock In Start</label>
                    <input
                      type="time"
                      className="form-control"
                      name="clock_in_start"
                      value={settings.clock_in_start}
                      onChange={handleSettingChange}
                    />
                  </div>
                  <div className="col-6 mb-3">
                    <label className="form-label">Clock In End</label>
                    <input
                      type="time"
                      className="form-control"
                      name="clock_in_end"
                      value={settings.clock_in_end}
                      onChange={handleSettingChange}
                    />
                  </div>
                  <div className="col-6 mb-3">
                    <label className="form-label">Clock Out Start</label>
                    <input
                      type="time"
                      className="form-control"
                      name="clock_out_start"
                      value={settings.clock_out_start}
                      onChange={handleSettingChange}
                    />
                  </div>
                  <div className="col-6 mb-3">
                    <label className="form-label">Clock Out End</label>
                    <input
                      type="time"
                      className="form-control"
                      name="clock_out_end"
                      value={settings.clock_out_end}
                      onChange={handleSettingChange}
                    />
                  </div>
                </div>
              </div>

              {/* NEW: Standard Work Hours Section */}
              <div className="col-md-6 mb-4">
                <h6 className="border-bottom pb-2">⏱️ Standard Work Day</h6>
                <div className="row">
                  <div className="col-12 mb-3">
                    <label className="form-label fw-bold">Standard Work Hours Per Day</label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        name="standard_work_hours"
                        value={settings.standard_work_hours || 8}
                        onChange={handleNumberChange}
                        min="1"
                        max="24"
                        step="0.5"
                      />
                      <span className="input-group-text">hours</span>
                    </div>
                    <small className="text-muted">
                      Hours worked beyond this threshold will be considered OVERTIME
                    </small>
                  </div>
                  <div className="col-12 mt-2">
                    <div className="alert alert-info py-2">
                      <small>
                        <strong>💡 How it works:</strong> If an employee works more than{" "}
                        <strong>{settings.standard_work_hours || 8} hours</strong> in a regular day,
                        the excess becomes overtime at {settings.overtime_rate || 1.25}x rate.
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grace Period */}
              <div className="col-md-6 mb-4">
                <h6 className="border-bottom pb-2">⏰ Grace Period & Auto Clock-out</h6>
                <div className="row">
                  <div className="col-6 mb-3">
                    <label className="form-label">Grace Period (minutes)</label>
                    <input
                      type="number"
                      className="form-control"
                      name="grace_period_minutes"
                      value={settings.grace_period_minutes}
                      onChange={handleNumberChange}
                      min="0"
                      max="120"
                    />
                  </div>
                  <div className="col-6 mb-3">
                    <label className="form-label">Late Threshold</label>
                    <input
                      type="time"
                      className="form-control"
                      name="late_threshold"
                      value={settings.late_threshold}
                      onChange={handleSettingChange}
                    />
                  </div>
                  <div className="col-12 mb-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="auto_clock_out_enabled"
                        checked={settings.auto_clock_out_enabled}
                        onChange={handleSettingChange}
                      />
                      <label className="form-check-label">Enable Auto Clock-Out</label>
                    </div>
                  </div>
                  {settings.auto_clock_out_enabled && (
                    <div className="col-12">
                      <label className="form-label">Auto Clock-Out Time</label>
                      <input
                        type="time"
                        className="form-control"
                        name="auto_clock_out_time"
                        value={settings.auto_clock_out_time}
                        onChange={handleSettingChange}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Break Settings */}
              <div className="col-md-6 mb-4">
                <h6 className="border-bottom pb-2">🍽️ Break Settings</h6>
                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    name="break_enabled"
                    checked={settings.break_enabled}
                    onChange={handleSettingChange}
                  />
                  <label className="form-check-label">Enable Break Period</label>
                </div>

                {settings.break_enabled && (
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label">Break Start</label>
                      <input
                        type="time"
                        className="form-control"
                        name="break_start"
                        value={settings.break_start}
                        onChange={handleSettingChange}
                      />
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label">Break End</label>
                      <input
                        type="time"
                        className="form-control"
                        name="break_end"
                        value={settings.break_end}
                        onChange={handleSettingChange}
                      />
                    </div>
                    <div className="col-12">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          name="unpaid_break"
                          checked={settings.unpaid_break}
                          onChange={handleSettingChange}
                        />
                        <label className="form-check-label">Unpaid Break</label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Work Days */}
              <div className="col-md-6 mb-4">
                <h6 className="border-bottom pb-2">📅 Work Days</h6>
                <div className="d-flex flex-wrap">
                  {weekdays.map(day => (
                    <div key={day} className="form-check me-4 mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={settings.work_days?.includes(day)}
                        onChange={() => handleWorkDayToggle(day)}
                      />
                      <label className="form-check-label">{day}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rate Settings */}
              <div className="col-md-6 mb-4">
                <h6 className="border-bottom pb-2">💰 Rate Settings</h6>
                <div className="row">
                  <div className="col-4 mb-3">
                    <label className="form-label">OT Rate</label>
                    <input
                      type="number"
                      className="form-control"
                      name="overtime_rate"
                      value={settings.overtime_rate}
                      onChange={handleNumberChange}
                      min="1"
                      max="3"
                      step="0.05"
                    />
                  </div>
                  <div className="col-4 mb-3">
                    <label className="form-label">Sunday Rate</label>
                    <input
                      type="number"
                      className="form-control"
                      name="sunday_rate"
                      value={settings.sunday_rate}
                      onChange={handleNumberChange}
                      min="1"
                      max="3"
                      step="0.05"
                    />
                  </div>
                  <div className="col-4 mb-3">
                    <label className="form-label">Holiday Rate</label>
                    <input
                      type="number"
                      className="form-control"
                      name="holiday_rate"
                      value={settings.holiday_rate}
                      onChange={handleNumberChange}
                      min="1"
                      max="3"
                      step="0.05"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="text-end mt-3">
              <button
                className="btn btn-warning px-4"
                onClick={saveSettings}
                disabled={loading}
              >
                {loading ? "Saving..." : "💾 Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card bg-light mb-3">
        <div className="card-body py-2">
          <div className="d-flex flex-wrap gap-4 align-items-center">
            <span><span className="badge bg-danger">🔴</span> Regular Holiday</span>
            <span><span className="badge bg-warning text-dark">🟠</span> Special Holiday</span>
            <span><span className="badge" style={{backgroundColor: "#ffc107"}}>🟡</span> Special Non-Working</span>
            <span><span className="badge bg-primary">🔵</span> Company Event</span>
            <span><span className="badge bg-success">🟢</span> Training</span>
            <span><span className="badge" style={{backgroundColor: "#ff69b4"}}>💗</span> Birthday</span>
            {settings && (
              <span className="ms-auto">
                <small className="text-muted">
                  <strong>Work Day:</strong> {settings.standard_work_hours || 8}h | 
                  <strong> OT:</strong> {settings.overtime_rate || 1.25}x
                </small>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="card shadow">
        <div className="card-body p-3">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            height="auto"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,dayGridWeek'
            }}
            eventClick={(info) => {
              const type = info.event.extendedProps?.type;
              const id = info.event.id;
              
              if (type === "holiday") {
                if (window.confirm(`Delete holiday "${info.event.title}"?`)) {
                  deleteHoliday(id);
                }
              } else if (type === "event") {
                if (window.confirm(`Delete event "${info.event.title}"?`)) {
                  deleteEvent(id);
                }
              }
            }}
            dateClick={(info) => {
              // Ask what type to add
              const choice = window.confirm(
                "Add to this date?\nOK = Add Holiday\nCancel = Add Event"
              );
              if (choice) {
                setNewHoliday({...newHoliday, date: info.dateStr});
                setActiveTab("add-holiday");
              } else {
                setNewEvent({...newEvent, date: info.dateStr});
                setActiveTab("add-event");
              }
            }}
          />
        </div>
      </div>

      {/* Holiday List */}
      {activeTab === "calendar" && (
        <div className="row mt-4">
          <div className="col-md-6">
            <div className="card">
              <div className="card-header bg-danger text-white">
                <h6 className="mb-0">📋 Holidays {holidays.length}</h6>
              </div>
              <div className="card-body" style={{maxHeight: "200px", overflowY: "auto"}}>
                <ul className="list-group">
                  {holidays.map(holiday => (
                    <li key={holiday._id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <span className="badge me-2" style={{backgroundColor: holiday.color}}> </span>
                        {holiday.name} - {holiday.date}
                      </div>
                      <button 
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteHoliday(holiday._id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card">
              <div className="card-header bg-success text-white">
                <h6 className="mb-0">📋 Events {companyEvents.length}</h6>
              </div>
              <div className="card-body" style={{maxHeight: "200px", overflowY: "auto"}}>
                <ul className="list-group">
                  {companyEvents.map(event => (
                    <li key={event._id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <span className="badge me-2" style={{backgroundColor: event.color}}> </span>
                        {event.title} - {event.date}
                      </div>
                      <button 
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteEvent(event._id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyCalendar;