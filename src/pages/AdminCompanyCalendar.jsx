import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import API from "../services/api";
const CompanyCalendar = () => {
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [companyEvents, setCompanyEvents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeSection, setActiveSection] = useState("calendar");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  
  const currentYear = new Date().getFullYear();

  // Form states
  const [newHoliday, setNewHoliday] = useState({ name: "", date: "", type: "regular", description: "" });
  const [newEvent, setNewEvent] = useState({ title: "", date: "", type: "company-event", description: "" });
  const [nightShiftBreak, setNightShiftBreak] = useState({ enabled: false, start: "00:00", end: "01:00", unpaid: true, duration: 60 });
  const [lateDeductionSettings, setLateDeductionSettings] = useState({
    late_deduction_enabled: true,
    late_deduction_minutes: 30,
    late_deduction_type: "time",
    late_deduction_amount: 0,
    late_deduction_percentage: 0,
    late_deduction_multiple_occurrences: true,
    late_deduction_cap: 4
  });

  // Holiday pay settings - CORRECTED LOGIC
  const [holidayPaySettings, setHolidayPaySettings] = useState({
    regular_holiday_paid: true,      // True = paid even if absent (8 hours regular rate)
    regular_holiday_rate: 2.0,       // Premium rate if present
    special_working_paid: true,       // True = paid if they work (regular rate)
    special_working_rate: 1.0,
    special_non_working_paid: false,  // False = no work, no pay (only paid if work)
    special_non_working_rate: 1.3
  });

  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Holiday type configurations with colors
  const holidayTypes = {
    regular: {
      name: "Regular Holiday",
      color: "#dc3545",
      textColor: "#fff",
      icon: "🔴",
      description: "Paid even if absent (8 hours regular rate) | Present: premium rate"
    },
    special_working: {
      name: "Special Working Day",
      color: "#fd7e14",
      textColor: "#fff",
      icon: "🟠",
      description: "Paid only if work (regular rate)"
    },
    special_non_working: {
      name: "Special Non-Working Day",
      color: "#ffc107",
      textColor: "#000",
      icon: "🟡",
      description: "Paid only if work (premium rate)"
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchHolidays(),
      fetchCompanyEvents(),
      fetchSettings(),
      fetchLateDeductionSettings(),
      fetchHolidayPaySettings()
    ]);
    setLoading(false);
  };

  const fetchHolidays = async () => {
    try {
      const response = await API.get("/calendar/holidays");
      if (response.data.success) {
        setHolidays(response.data.holidays);
        
        const holidayEvents = response.data.holidays.map(holiday => {
          const typeConfig = holidayTypes[holiday.type] || holidayTypes.regular;
          
          let color, textColor;
          if (holiday.type === "regular") {
            color = "#dc3545";
            textColor = "#fff";
          } else if (holiday.type === "special_working") {
            color = "#fd7e14";
            textColor = "#fff";
          } else {
            color = "#ffc107";
            textColor = "#000";
          }
          
          // Check paid status based on settings
          let isPaid = true;
          let rate = 1.0;
          let paidDescription = "";
          
          if (holiday.type === "regular") {
            isPaid = holidayPaySettings.regular_holiday_paid;
            rate = holidayPaySettings.regular_holiday_rate;
            if (isPaid) {
              paidDescription = "Paid even if absent (8h regular)";
            } else {
              paidDescription = "Paid only if work";
            }
          } else if (holiday.type === "special_working") {
            isPaid = holidayPaySettings.special_working_paid;
            rate = holidayPaySettings.special_working_rate;
            paidDescription = isPaid ? "Paid if work" : "Unpaid work";
          } else {
            isPaid = holidayPaySettings.special_non_working_paid;
            rate = holidayPaySettings.special_non_working_rate;
            paidDescription = isPaid ? "Paid if work (premium)" : "No work, no pay";
          }
          
          const icon = typeConfig.icon;
          const paidIndicator = isPaid ? "💰" : "💀";
          
          let title = `${icon} ${paidIndicator} ${holiday.name}`;
          if (rate > 1) {
            title += ` (${rate}x)`;
          }
          
          return {
            id: holiday._id,
            title: title,
            date: holiday.date,
            color: color,
            borderColor: color,
            textColor: textColor,
            extendedProps: { 
              type: "holiday", 
              holidayType: holiday.type,
              isPaid: isPaid,
              rate: rate,
              description: paidDescription
            }
          };
        });
        
        setEvents(prev => [...prev.filter(e => e.extendedProps?.type !== "holiday"), ...holidayEvents]);
      }
    } catch (error) {
      console.error("Failed to fetch holidays:", error);
    }
  };

  const fetchCompanyEvents = async () => {
    try {
      const response = await API.get("/calendar/events");
      if (response.data.success) {
        setCompanyEvents(response.data.events);
        
        const eventItems = response.data.events.map(event => {
          let color, textColor, icon;
          
          switch(event.type) {
            case "meeting":
              color = "#fd7e14";
              textColor = "#fff";
              icon = "📅";
              break;
            case "deadline":
              color = "#dc3545";
              textColor = "#fff";
              icon = "⏰";
              break;
            case "training":
              color = "#198754";
              textColor = "#fff";
              icon = "📚";
              break;
            case "birthday":
              color = "#ff69b4";
              textColor = "#fff";
              icon = "🎂";
              break;
            default:
              color = "#0d6efd";
              textColor = "#fff";
              icon = "🎉";
          }
          
          return {
            id: event._id,
            title: `${icon} ${event.title}`,
            date: event.date,
            color: color,
            borderColor: color,
            textColor: textColor,
            extendedProps: { type: "event", eventType: event.type }
          };
        });
        
        setEvents(prev => [...prev.filter(e => e.extendedProps?.type !== "event"), ...eventItems]);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await API.get("/attendance/settings");
      if (response.data.success) {
        setSettings(response.data.settings);
        if (response.data.settings.night_shift_break) {
          setNightShiftBreak(response.data.settings.night_shift_break);
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  const fetchLateDeductionSettings = async () => {
    try {
      const response = await API.get("/attendance/late-deduction-settings");
      if (response.data.success) {
        setLateDeductionSettings(response.data.settings);
      }
    } catch (error) {
      console.error("Failed to fetch late deduction settings:", error);
    }
  };

  const fetchHolidayPaySettings = async () => {
    try {
      const response = await API.get("/attendance/settings");
      if (response.data.success) {
        const settings = response.data.settings;
        
        setHolidayPaySettings({
          regular_holiday_paid: settings.regular_holiday_paid ?? true,
          regular_holiday_rate: settings.regular_holiday_rate ?? 2.0,
          special_working_paid: settings.special_working_paid ?? true,
          special_working_rate: settings.special_working_rate ?? 1.0,
          special_non_working_paid: settings.special_non_working_paid ?? false,
          special_non_working_rate: settings.special_non_working_rate ?? 1.3
        });
      }
    } catch (error) {
      console.error("Failed to fetch holiday pay settings:", error);
    }
  };

  const saveHolidayPaySettings = async () => {
    setLoading(true);
    try {
      const currentSettingsResponse = await API.get("/attendance/settings");
      if (currentSettingsResponse.data.success) {
        const currentSettings = currentSettingsResponse.data.settings;
        
        const updatedSettings = {
          ...currentSettings,
          regular_holiday_paid: holidayPaySettings.regular_holiday_paid,
          regular_holiday_rate: holidayPaySettings.regular_holiday_rate,
          special_working_paid: holidayPaySettings.special_working_paid,
          special_working_rate: holidayPaySettings.special_working_rate,
          special_non_working_paid: holidayPaySettings.special_non_working_paid,
          special_non_working_rate: holidayPaySettings.special_non_working_rate
        };
        
        const response = await API.post("/attendance/settings", updatedSettings);
        if (response.data.success) {
          showMessage("success", "Holiday pay settings saved!");
          await fetchHolidayPaySettings();
          await fetchHolidays();
        } else {
          showMessage("danger", "Error saving holiday pay settings");
        }
      }
    } catch (error) {
      console.error("Error saving holiday pay settings:", error);
      showMessage("danger", "Error saving holiday pay settings");
    } finally {
      setLoading(false);
    }
  };

  const saveLateDeductionSettings = async () => {
    setLoading(true);
    try {
      const response = await API.post("/attendance/late-deduction-settings", lateDeductionSettings);
      if (response.data.success) {
        showMessage("success", "Late deduction settings saved!");
      }
    } catch (error) {
      showMessage("danger", "Error saving late deduction settings");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const updatedSettings = { ...settings, night_shift_break: nightShiftBreak };
      const response = await API.post("/attendance/settings", updatedSettings);
      if (response.data.success) {
        showMessage("success", "Settings saved successfully!");
        await fetchSettings();
      } else {
        showMessage("danger", "Error saving settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      showMessage("danger", "Error saving settings");
    } finally {
      setLoading(false);
    }
  };

  const saveHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) {
      showMessage("danger", "Holiday name and date are required!");
      return;
    }
    setLoading(true);
    try {
      const response = await API.post("/calendar/holidays", newHoliday);
      if (response.data.success) {
        await fetchHolidays();
        setNewHoliday({ name: "", date: "", type: "regular", description: "" });
        setActiveSection("calendar");
        showMessage("success", "Holiday added successfully!");
      }
    } catch (error) {
      showMessage("danger", error.response?.data?.message || "Failed to add holiday");
    } finally {
      setLoading(false);
    }
  };

  const saveEvent = async () => {
    if (!newEvent.title || !newEvent.date) {
      showMessage("danger", "Event title and date are required!");
      return;
    }
    setLoading(true);
    try {
      const response = await API.post("/calendar/events", newEvent);
      if (response.data.success) {
        await fetchCompanyEvents();
        setNewEvent({ title: "", date: "", type: "company-event", description: "" });
        setActiveSection("calendar");
        showMessage("success", "Event added successfully!");
      }
    } catch (error) {
      showMessage("danger", "Failed to add event");
    } finally {
      setLoading(false);
    }
  };

  const deleteHoliday = async (holidayId) => {
    if (!window.confirm("Delete this holiday?")) return;
    try {
      await API.delete(`/calendar/holidays/${holidayId}`);
      await fetchHolidays();
      showMessage("success", "Holiday deleted!");
    } catch (error) {
      showMessage("danger", "Failed to delete holiday");
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      await API.delete(`/calendar/events/${eventId}`);
      await fetchCompanyEvents();
      showMessage("success", "Event deleted!");
    } catch (error) {
      showMessage("danger", "Failed to delete event");
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 3000);
  };

  const handleSettingChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handleHolidayPayChange = (e) => {
    const { name, value, type, checked } = e.target;
    setHolidayPaySettings(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : parseFloat(value) || 0
    }));
  };

  const handleLateDeductionChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLateDeductionSettings(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? parseFloat(value) || 0 : value
    }));
  };

  const handleWorkDayToggle = (day) => {
    setSettings(prev => ({
      ...prev,
      work_days: prev.work_days?.includes(day)
        ? prev.work_days.filter(d => d !== day)
        : [...(prev.work_days || []), day]
    }));
  };

  const formatRateDisplay = (rate) => {
    if (!rate || rate === 1) return "Regular";
    const percentage = (rate - 1) * 100;
    return `+${percentage.toFixed(0)}%`;
  };

  useEffect(() => {
    if (nightShiftBreak.start && nightShiftBreak.end) {
      const [startHour, startMin] = nightShiftBreak.start.split(':').map(Number);
      const [endHour, endMin] = nightShiftBreak.end.split(':').map(Number);
      let duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      if (duration < 0) duration += 24 * 60;
      setNightShiftBreak(prev => ({ ...prev, duration }));
    }
  }, [nightShiftBreak.start, nightShiftBreak.end]);

  const sections = [
    { id: "calendar", label: "📅 Calendar", color: "primary" },
    { id: "holidays", label: "🇵🇭 Holidays", color: "danger" },
    { id: "events", label: "🎉 Events", color: "success" },
    { id: "holiday-pay", label: "💰 Holiday Pay", color: "info" },
    { id: "general", label: "⚙️ General Settings", color: "secondary" },
    { id: "late", label: "⏰ Late Deduction", color: "warning" },
    { id: "night", label: "🌙 Night Shift", color: "dark" }
  ];

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">Company Calendar {currentYear}</h4>
          <small className="text-muted">Manage holidays, events, and attendance settings</small>
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

      {/* Message */}
      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible fade show mb-4`}>
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ type: "", text: "" })} />
        </div>
      )}

      {/* Quick Stats Bar */}
      {settings && activeSection !== "general" && activeSection !== "late" && activeSection !== "night" && activeSection !== "holiday-pay" && (
        <div className="card bg-light mb-4">
          <div className="card-body py-2">
            <div className="row text-center">
              <div className="col-md-2">
                <small className="text-muted">Shift:</small>
                <div><strong>{settings.clock_in_start} - {settings.clock_out_end}</strong></div>
              </div>
              <div className="col-md-2">
                <small className="text-muted">Work Hours:</small>
                <div><strong className="text-primary">{settings.standard_work_hours || 8}h</strong></div>
              </div>
              <div className="col-md-2">
                <small className="text-muted">Grace Period:</small>
                <div><strong>{settings.grace_period_minutes} min</strong></div>
              </div>
              <div className="col-md-2">
                <small className="text-muted">Break:</small>
                <div><strong>{settings.break_enabled ? `${settings.break_start} - ${settings.break_end}` : "None"}</strong></div>
              </div>
              <div className="col-md-2">
                <small className="text-muted">OT Rate:</small>
                <div><strong className="text-success">{formatRateDisplay(settings.overtime_rate)}</strong></div>
              </div>
              <div className="col-md-2">
                <small className="text-muted">Holiday Pay:</small>
                <div><strong className="text-danger">{holidayPaySettings.regular_holiday_paid ? "Paid if absent" : "Unpaid if absent"}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Pills */}
      <ul className="nav nav-pills mb-4 justify-content-center flex-wrap">
        {sections.map(section => (
          <li className="nav-item" key={section.id}>
            <button
              className={`nav-link mx-1 my-1 ${activeSection === section.id ? `active bg-${section.color}` : `text-${section.color}`}`}
              onClick={() => setActiveSection(section.id)}
              style={{ cursor: "pointer" }}
            >
              {section.label}
            </button>
          </li>
        ))}
      </ul>

      {/* ==================== CALENDAR SECTION ==================== */}
      {activeSection === "calendar" && (
        <>
          {/* Legend */}
          <div className="card bg-light mb-3">
            <div className="card-body py-2">
              <div className="d-flex flex-wrap gap-3 justify-content-center align-items-center">
                <span><span className="badge" style={{backgroundColor: "#dc3545", color: "white"}}>🔴</span> Regular Holiday</span>
                <span><span className="badge" style={{backgroundColor: "#fd7e14", color: "white"}}>🟠</span> Special Working Day</span>
                <span><span className="badge" style={{backgroundColor: "#ffc107", color: "#000"}}>🟡</span> Special Non-Working Day</span>
                <span><span className="badge bg-primary" style={{backgroundColor: "#0d6efd"}}>🔵</span> Company Event</span>
                <span><span className="badge bg-success" style={{backgroundColor: "#198754"}}>🟢</span> Training</span>
                <span><span className="badge" style={{backgroundColor: "#fd7e14", color: "white"}}>🟠</span> Meeting</span>
                <span><span className="badge bg-danger" style={{backgroundColor: "#dc3545"}}>🔴</span> Deadline</span>
                <span><span className="badge" style={{backgroundColor: "#ff69b4", color: "white"}}>💗</span> Birthday</span>
                <span className="ms-auto">
                  <small>💰 = Gets pay | 💀 = No pay</small>
                </span>
                <span>
                  <small>💡 Click date to add | Click event to delete</small>
                </span>
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
                eventDidMount={(info) => {
                  if (info.event.extendedProps?.description) {
                    info.el.setAttribute('title', info.event.extendedProps.description);
                  }
                }}
                eventClick={(info) => {
                  const type = info.event.extendedProps?.type;
                  const id = info.event.id;
                  if (type === "holiday") {
                    if (window.confirm(`Delete holiday "${info.event.title}"?`)) deleteHoliday(id);
                  } else if (type === "event") {
                    if (window.confirm(`Delete event "${info.event.title}"?`)) deleteEvent(id);
                  }
                }}
                dateClick={(info) => {
                  const choice = window.confirm("Add to this date?\nOK = Holiday\nCancel = Event");
                  if (choice) {
                    setNewHoliday({...newHoliday, date: info.dateStr});
                    setActiveSection("holidays");
                  } else {
                    setNewEvent({...newEvent, date: info.dateStr});
                    setActiveSection("events");
                  }
                }}
              />
            </div>
          </div>

          {/* Lists */}
          <div className="row mt-4">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header bg-danger text-white">
                  <h6 className="mb-0">📋 Holidays ({holidays.length})</h6>
                </div>
                <div className="card-body" style={{maxHeight: "200px", overflowY: "auto"}}>
                  {holidays.map(holiday => {
                    const typeConfig = holidayTypes[holiday.type] || holidayTypes.regular;
                    let isPaid = true;
                    let rate = 1.0;
                    
                    if (holiday.type === "regular") {
                      isPaid = holidayPaySettings.regular_holiday_paid;
                      rate = holidayPaySettings.regular_holiday_rate;
                    } else if (holiday.type === "special_working") {
                      isPaid = holidayPaySettings.special_working_paid;
                      rate = holidayPaySettings.special_working_rate;
                    } else {
                      isPaid = holidayPaySettings.special_non_working_paid;
                      rate = holidayPaySettings.special_non_working_rate;
                    }
                    
                    return (
                      <div key={holiday._id} className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                        <div>
                          <span style={{marginRight: "8px"}}>{typeConfig.icon}</span>
                          <strong>{holiday.name}</strong>
                          <small className="text-muted ms-2">{holiday.date}</small>
                          <span className={`badge ms-2 ${isPaid ? 'bg-success' : 'bg-secondary'}`}>
                            {isPaid ? `💰 ${rate > 1 ? rate + 'x' : 'Paid'}` : "💀 Unpaid"}
                          </span>
                          <br />
                          <small className="text-muted">{typeConfig.description}</small>
                        </div>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteHoliday(holiday._id)}>×</button>
                      </div>
                    );
                  })}
                  {holidays.length === 0 && <p className="text-muted text-center">No holidays</p>}
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-header bg-success text-white">
                  <h6 className="mb-0">📋 Events ({companyEvents.length})</h6>
                </div>
                <div className="card-body" style={{maxHeight: "200px", overflowY: "auto"}}>
                  {companyEvents.map(event => {
                    let icon = "🎉";
                    if (event.type === "meeting") icon = "📅";
                    if (event.type === "deadline") icon = "⏰";
                    if (event.type === "training") icon = "📚";
                    if (event.type === "birthday") icon = "🎂";
                    
                    return (
                      <div key={event._id} className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                        <div>
                          <strong>{icon} {event.title}</strong>
                          <small className="text-muted ms-2">{event.date}</small>
                        </div>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteEvent(event._id)}>×</button>
                      </div>
                    );
                  })}
                  {companyEvents.length === 0 && <p className="text-muted text-center">No events</p>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== HOLIDAY PAY SETTINGS SECTION ==================== */}
      {activeSection === "holiday-pay" && (
        <div className="card shadow-sm">
          <div className="card-header bg-info text-white">
            <h5 className="mb-0">💰 Holiday Pay Configuration</h5>
          </div>
          <div className="card-body">
            <div className="alert alert-warning mb-4">
              <strong>⚠️ Important:</strong> Configure how employees are paid for each holiday type.
              <ul className="mb-0 mt-2">
                <li><strong>Regular Holiday:</strong> {holidayPaySettings.regular_holiday_paid ? "✅ Paid even if absent (8 hours regular rate)" : "❌ Unpaid if absent"} | Present: {holidayPaySettings.regular_holiday_rate}x for actual hours</li>
                <li><strong>Special Working Day:</strong> {holidayPaySettings.special_working_paid ? "✅ Paid if work (regular rate)" : "❌ Unpaid work"}</li>
                <li><strong>Special Non-Working Day:</strong> {holidayPaySettings.special_non_working_paid ? "✅ Paid if work (premium rate)" : "❌ No work, no pay"}</li>
              </ul>
            </div>

            {/* Regular Holiday Settings */}
            <div className="card mb-4 border-danger">
              <div className="card-header bg-danger text-white">
                <h6 className="mb-0">🔴 Regular Holidays</h6>
              </div>
              <div className="card-body">
                <div className="form-check form-switch mb-3">
                  <input className="form-check-input" type="checkbox" name="regular_holiday_paid"
                    checked={holidayPaySettings.regular_holiday_paid} onChange={handleHolidayPayChange}
                    style={{ width: "3em", height: "1.5em" }} />
                  <label className="form-check-label fw-bold ms-2">
                    {holidayPaySettings.regular_holiday_paid ? "✅ Paid even if absent" : "❌ Unpaid if absent"}
                  </label>
                  <div className="text-muted small mt-1">
                    {holidayPaySettings.regular_holiday_paid 
                      ? "If absent: 8 hours at regular rate | If present: actual hours worked × premium rate"
                      : "If absent: No pay | If present: actual hours worked × premium rate"}
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-4">
                    <label>Premium Rate (if present)</label>
                    <div className="input-group">
                      <input type="number" className="form-control" name="regular_holiday_rate"
                        value={holidayPaySettings.regular_holiday_rate} onChange={handleHolidayPayChange}
                        step="0.01" min="1" />
                      <span className="input-group-text">x</span>
                    </div>
                    <small>Multiplier for actual hours worked</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Working Day Settings */}
            <div className="card mb-4" style={{borderColor: "#fd7e14"}}>
              <div className="card-header" style={{backgroundColor: "#fd7e14", color: "white"}}>
                <h6 className="mb-0">🟠 Special Working Days</h6>
              </div>
              <div className="card-body">
                <div className="form-check form-switch mb-3">
                  <input className="form-check-input" type="checkbox" name="special_working_paid"
                    checked={holidayPaySettings.special_working_paid} onChange={handleHolidayPayChange}
                    style={{ width: "3em", height: "1.5em" }} />
                  <label className="form-check-label fw-bold ms-2">
                    {holidayPaySettings.special_working_paid ? "✅ Paid (if work)" : "❌ Unpaid work"}
                  </label>
                  <div className="text-muted small mt-1">
                    {holidayPaySettings.special_working_paid 
                      ? "Employees get paid for working on special working days (regular rate)"
                      : "Employees do NOT get paid for working on special working days"}
                  </div>
                </div>

                {holidayPaySettings.special_working_paid && holidayPaySettings.special_working_rate > 1 && (
                  <div className="row">
                    <div className="col-md-4">
                      <label>Special Rate (if applicable)</label>
                      <div className="input-group">
                        <input type="number" className="form-control" name="special_working_rate"
                          value={holidayPaySettings.special_working_rate} onChange={handleHolidayPayChange}
                          step="0.01" min="1" />
                        <span className="input-group-text">x</span>
                      </div>
                      <small>Usually 1.0x (regular rate)</small>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Special Non-Working Day Settings */}
            <div className="card mb-4" style={{borderColor: "#ffc107"}}>
              <div className="card-header" style={{backgroundColor: "#ffc107", color: "#000"}}>
                <h6 className="mb-0">🟡 Special Non-Working Days</h6>
              </div>
              <div className="card-body">
                <div className="form-check form-switch mb-3">
                  <input className="form-check-input" type="checkbox" name="special_non_working_paid"
                    checked={holidayPaySettings.special_non_working_paid} onChange={handleHolidayPayChange}
                    style={{ width: "3em", height: "1.5em" }} />
                  <label className="form-check-label fw-bold ms-2">
                    {holidayPaySettings.special_non_working_paid ? "✅ Paid (if worked)" : "❌ No work, no pay"}
                  </label>
                  <div className="text-muted small mt-1">
                    {holidayPaySettings.special_non_working_paid 
                      ? "Employees get paid IF they work on special non-working days (with premium rate)"
                      : "Employees do NOT get paid (no work, no pay). They only get regular rate if forced to work"}
                  </div>
                </div>

                {holidayPaySettings.special_non_working_paid && (
                  <div className="row">
                    <div className="col-md-4">
                      <label>Premium Rate (if worked)</label>
                      <div className="input-group">
                        <input type="number" className="form-control" name="special_non_working_rate"
                          value={holidayPaySettings.special_non_working_rate} onChange={handleHolidayPayChange}
                          step="0.01" min="1" />
                        <span className="input-group-text">x</span>
                      </div>
                      <small>Multiplier for actual hours worked</small>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Card */}
            <div className="card bg-light mt-3">
              <div className="card-body">
                <h6>📊 Current Pay Settings Summary</h6>
                <div className="row mt-3">
                  <div className="col-md-4">
                    <strong>🔴 Regular Holidays:</strong>
                    <div>{holidayPaySettings.regular_holiday_paid ? "✅ Paid even if absent" : "❌ Unpaid if absent"}</div>
                    <div>Present rate: {holidayPaySettings.regular_holiday_rate}x</div>
                    {holidayPaySettings.regular_holiday_paid && <div>Absent: 8 hours regular rate</div>}
                  </div>
                  <div className="col-md-4">
                    <strong>🟠 Special Working Days:</strong>
                    <div>{holidayPaySettings.special_working_paid ? "✅ Paid if work" : "❌ Unpaid work"}</div>
                    <div>Rate: {holidayPaySettings.special_working_rate}x</div>
                  </div>
                  <div className="col-md-4">
                    <strong>🟡 Special Non-Working Days:</strong>
                    <div>{holidayPaySettings.special_non_working_paid ? "✅ Paid if work" : "❌ No work, no pay"}</div>
                    <div>Rate if worked: {holidayPaySettings.special_non_working_rate}x</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-end mt-4">
              <button className="btn btn-info" onClick={saveHolidayPaySettings} disabled={loading}>
                {loading ? "Saving..." : "Save Holiday Pay Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== HOLIDAYS SECTION ==================== */}
      {activeSection === "holidays" && (
        <div className="card shadow-sm">
          <div className="card-header bg-danger text-white">
            <h5 className="mb-0">🇵🇭 Add New Holiday</h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label>Holiday Name *</label>
                <input type="text" className="form-control" placeholder="e.g., Eid'l Fitr"
                  value={newHoliday.name} onChange={(e) => setNewHoliday({...newHoliday, name: e.target.value})} />
              </div>
              <div className="col-md-3 mb-3">
                <label>Date *</label>
                <input type="date" className="form-control"
                  value={newHoliday.date} onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})} />
              </div>
              <div className="col-md-3 mb-3">
                <label>Holiday Type</label>
                <select className="form-select" value={newHoliday.type} onChange={(e) => setNewHoliday({...newHoliday, type: e.target.value})}>
                  <option value="regular">🔴 Regular Holiday</option>
                  <option value="special_working">🟠 Special Working Day</option>
                  <option value="special_non_working">🟡 Special Non-Working Day</option>
                </select>
                <small className="text-muted">
                  {newHoliday.type === "regular" && "Paid even if absent (8h regular) | Present: premium rate"}
                  {newHoliday.type === "special_working" && "Paid only if work (regular rate)"}
                  {newHoliday.type === "special_non_working" && "Paid only if work (premium rate)"}
                </small>
              </div>
              <div className="col-md-2 mb-3 d-flex align-items-end">
                <button className="btn btn-danger w-100" onClick={saveHoliday} disabled={loading}>
                  {loading ? "Saving..." : "Save Holiday"}
                </button>
              </div>
            </div>
            <div className="row">
              <div className="col-12">
                <label>Description (Optional)</label>
                <input type="text" className="form-control" placeholder="Additional details"
                  value={newHoliday.description} onChange={(e) => setNewHoliday({...newHoliday, description: e.target.value})} />
              </div>
            </div>
            <hr className="my-4" />
            <h6>Existing Holidays</h6>
            <div className="row">
              {holidays.map(holiday => {
                const typeConfig = holidayTypes[holiday.type] || holidayTypes.regular;
                let isPaid = true;
                if (holiday.type === "regular") isPaid = holidayPaySettings.regular_holiday_paid;
                else if (holiday.type === "special_working") isPaid = holidayPaySettings.special_working_paid;
                else if (holiday.type === "special_non_working") isPaid = holidayPaySettings.special_non_working_paid;
                
                return (
                  <div key={holiday._id} className="col-md-6 mb-2">
                    <div className="d-flex justify-content-between align-items-center p-2 border rounded" style={{backgroundColor: typeConfig.color + "20"}}>
                      <div>
                        <span style={{marginRight: "8px"}}>{typeConfig.icon}</span>
                        <strong>{holiday.name}</strong>
                        <small className="text-muted ms-2">{holiday.date}</small>
                        <br />
                        <small className="text-muted">{typeConfig.description}</small>
                        <span className={`badge ms-2 ${isPaid ? 'bg-success' : 'bg-secondary'}`}>
                          {isPaid ? "💰 Paid" : "💀 Unpaid"}
                        </span>
                      </div>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteHoliday(holiday._id)}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== EVENTS SECTION ==================== */}
      {activeSection === "events" && (
        <div className="card shadow-sm">
          <div className="card-header bg-success text-white">
            <h5 className="mb-0">🎉 Add New Event</h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label>Event Title *</label>
                <input type="text" className="form-control" placeholder="e.g., Company Meeting"
                  value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} />
              </div>
              <div className="col-md-3 mb-3">
                <label>Date *</label>
                <input type="date" className="form-control"
                  value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} />
              </div>
              <div className="col-md-3 mb-3">
                <label>Event Type</label>
                <select className="form-select" value={newEvent.type} onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}>
                  <option value="company-event">🎉 Company Event</option>
                  <option value="meeting">📅 Meeting</option>
                  <option value="deadline">⏰ Deadline</option>
                  <option value="training">📚 Training</option>
                  <option value="birthday">🎂 Birthday</option>
                </select>
              </div>
              <div className="col-md-2 mb-3 d-flex align-items-end">
                <button className="btn btn-success w-100" onClick={saveEvent} disabled={loading}>
                  {loading ? "Saving..." : "Save Event"}
                </button>
              </div>
            </div>
            <div className="row">
              <div className="col-12">
                <label>Description (Optional)</label>
                <input type="text" className="form-control" placeholder="Additional details"
                  value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} />
              </div>
            </div>
            <hr className="my-4" />
            <h6>Existing Events</h6>
            <div className="row">
              {companyEvents.map(event => {
                let icon = "🎉";
                if (event.type === "meeting") icon = "📅";
                if (event.type === "deadline") icon = "⏰";
                if (event.type === "training") icon = "📚";
                if (event.type === "birthday") icon = "🎂";
                
                return (
                  <div key={event._id} className="col-md-6 mb-2">
                    <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                      <div>
                        <strong>{icon} {event.title}</strong>
                        <small className="text-muted ms-2">{event.date}</small>
                      </div>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteEvent(event._id)}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== GENERAL SETTINGS SECTION ==================== */}
      {activeSection === "general" && settings && (
        <div className="card shadow-sm">
          <div className="card-header bg-secondary text-white">
            <h5 className="mb-0">⚙️ General Settings</h5>
          </div>
          <div className="card-body">
            {/* Clock Times */}
            <div className="row">
              <div className="col-md-6 mb-4">
                <h6 className="border-bottom pb-2">🕒 Clock Times</h6>
                <div className="row">
                  <div className="col-6 mb-3">
                    <label>Clock In Start</label>
                    <input type="time" className="form-control" name="clock_in_start"
                      value={settings.clock_in_start} onChange={handleSettingChange} />
                  </div>
                  <div className="col-6 mb-3">
                    <label>Clock In End</label>
                    <input type="time" className="form-control" name="clock_in_end"
                      value={settings.clock_in_end} onChange={handleSettingChange} />
                  </div>
                  <div className="col-6 mb-3">
                    <label>Clock Out Start</label>
                    <input type="time" className="form-control" name="clock_out_start"
                      value={settings.clock_out_start} onChange={handleSettingChange} />
                  </div>
                  <div className="col-6 mb-3">
                    <label>Clock Out End</label>
                    <input type="time" className="form-control" name="clock_out_end"
                      value={settings.clock_out_end} onChange={handleSettingChange} />
                  </div>
                </div>
              </div>

              {/* Work Hours & Days */}
              <div className="col-md-6 mb-4">
                <h6 className="border-bottom pb-2">⏱️ Work Schedule</h6>
                <div className="mb-3">
                  <label>Standard Work Hours Per Day</label>
                  <div className="input-group">
                    <input type="number" className="form-control" name="standard_work_hours"
                      value={settings.standard_work_hours || 8} onChange={handleNumberChange} step="0.5" min="1" />
                    <span className="input-group-text">hours</span>
                  </div>
                  <small>Hours beyond this are OVERTIME</small>
                </div>
                
                <div className="mb-3">
                  <label>Work Days</label>
                  <div className="d-flex flex-wrap">
                    {weekdays.map(day => (
                      <div key={day} className="form-check me-3">
                        <input className="form-check-input" type="checkbox"
                          checked={settings.work_days?.includes(day)} onChange={() => handleWorkDayToggle(day)} />
                        <label className="form-check-label">{day.substring(0,3)}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Grace Period & Auto Clock-out */}
            <div className="row">
              <div className="col-md-6 mb-4">
                <h6 className="border-bottom pb-2">⏰ Grace Period & Late</h6>
                <div className="row">
                  <div className="col-6 mb-3">
                    <label>Grace Period</label>
                    <div className="input-group">
                      <input type="number" className="form-control" name="grace_period_minutes"
                        value={settings.grace_period_minutes} onChange={handleNumberChange} min="0" />
                      <span className="input-group-text">minutes</span>
                    </div>
                  </div>
                  <div className="col-6 mb-3">
                    <label>Late Threshold</label>
                    <input type="time" className="form-control" name="late_threshold"
                      value={settings.late_threshold} onChange={handleSettingChange} />
                  </div>
                </div>
                
                <div className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" name="auto_clock_out_enabled"
                    checked={settings.auto_clock_out_enabled} onChange={handleSettingChange} />
                  <label>Enable Auto Clock-Out</label>
                </div>
                
                {settings.auto_clock_out_enabled && (
                  <div>
                    <label>Auto Clock-Out Time</label>
                    <input type="time" className="form-control" name="auto_clock_out_time"
                      value={settings.auto_clock_out_time} onChange={handleSettingChange} />
                  </div>
                )}
              </div>

              {/* Break Settings */}
              <div className="col-md-6 mb-4">
                <h6 className="border-bottom pb-2">🍽️ Break Settings</h6>
                <div className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" name="break_enabled"
                    checked={settings.break_enabled} onChange={handleSettingChange} />
                  <label className="form-check-label fw-bold">Enable Break Period</label>
                </div>

                {settings.break_enabled && (
                  <div className="row">
                    <div className="col-md-5 mb-3">
                      <label>Break Start</label>
                      <input type="time" className="form-control" name="break_start"
                        value={settings.break_start} onChange={handleSettingChange} />
                    </div>
                    <div className="col-md-5 mb-3">
                      <label>Break End</label>
                      <input type="time" className="form-control" name="break_end"
                        value={settings.break_end} onChange={handleSettingChange} />
                    </div>
                    <div className="col-md-2 mb-3">
                      <div className="form-check mt-4">
                        <input className="form-check-input" type="checkbox" name="unpaid_break"
                          checked={settings.unpaid_break} onChange={handleSettingChange} />
                        <label>Unpaid</label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rate Settings */}
            <div className="row">
              <div className="col-12 mb-4">
                <h6 className="border-bottom pb-2">💰 Rate Settings</h6>
                <div className="alert alert-info mb-3">
                  <small>Rates are multipliers (1.25 = 25% extra)</small>
                </div>
                <div className="row">
                  <div className="col-md-3 mb-3">
                    <label>Overtime Rate</label>
                    <div className="input-group">
                      <input type="number" className="form-control" name="overtime_rate"
                        value={settings.overtime_rate} onChange={handleNumberChange} step="0.01" min="1" />
                      <span className="input-group-text">x</span>
                    </div>
                    <small>{formatRateDisplay(settings.overtime_rate)}</small>
                  </div>
                  <div className="col-md-3 mb-3">
                    <label>Sunday Rate</label>
                    <div className="input-group">
                      <input type="number" className="form-control" name="sunday_rate"
                        value={settings.sunday_rate} onChange={handleNumberChange} step="0.01" min="1" />
                      <span className="input-group-text">x</span>
                    </div>
                    <small>{formatRateDisplay(settings.sunday_rate)}</small>
                  </div>
                  <div className="col-md-3 mb-3">
                    <label>Night Differential</label>
                    <div className="input-group">
                      <input type="number" className="form-control" name="night_shift_differential"
                        value={settings.night_shift_differential || 1.10} onChange={handleNumberChange} step="0.01" min="1" />
                      <span className="input-group-text">x</span>
                    </div>
                    <small>{formatRateDisplay(settings.night_shift_differential || 1.10)}</small>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-end mt-3">
              <button className="btn btn-secondary" onClick={saveSettings} disabled={loading}>
                {loading ? "Saving..." : "Save All Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LATE DEDUCTION SECTION ==================== */}
      {activeSection === "late" && (
        <div className="card shadow-sm">
          <div className="card-header bg-warning">
            <h5 className="mb-0">⏰ Late Deduction Settings</h5>
          </div>
          <div className="card-body">
            <div className="form-check form-switch mb-4">
              <input className="form-check-input" type="checkbox" name="late_deduction_enabled"
                checked={lateDeductionSettings.late_deduction_enabled} onChange={handleLateDeductionChange}
                style={{ width: "3em", height: "1.5em" }} />
              <label className="form-check-label fw-bold ms-2">
                {lateDeductionSettings.late_deduction_enabled ? "✅ Enabled" : "❌ Disabled"}
              </label>
            </div>

            {lateDeductionSettings.late_deduction_enabled && (
              <>
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label>Deduction Minutes</label>
                    <div className="input-group">
                      <input type="number" className="form-control" name="late_deduction_minutes"
                        value={lateDeductionSettings.late_deduction_minutes} onChange={handleLateDeductionChange} step="15" />
                      <span className="input-group-text">minutes</span>
                    </div>
                    <small>≈ {(lateDeductionSettings.late_deduction_minutes / 60).toFixed(2)} hour(s)</small>
                  </div>
                  <div className="col-md-4 mb-3">
                    <label>Weekly Cap</label>
                    <div className="input-group">
                      <input type="number" className="form-control" name="late_deduction_cap"
                        value={lateDeductionSettings.late_deduction_cap} onChange={handleLateDeductionChange} />
                      <span className="input-group-text">occurrences</span>
                    </div>
                  </div>
                  <div className="col-md-4 mb-3">
                    <label>Deduction Type</label>
                    <select className="form-select" name="late_deduction_type" value={lateDeductionSettings.late_deduction_type} onChange={handleLateDeductionChange}>
                      <option value="time">Time-based (minutes)</option>
                      <option value="fixed">Fixed Amount (₱)</option>
                      <option value="percentage">Percentage of Hourly Rate</option>
                    </select>
                  </div>
                </div>

                {(lateDeductionSettings.late_deduction_type === "fixed") && (
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label>Fixed Amount</label>
                      <div className="input-group">
                        <span className="input-group-text">₱</span>
                        <input type="number" className="form-control" name="late_deduction_amount"
                          value={lateDeductionSettings.late_deduction_amount} onChange={handleLateDeductionChange} />
                      </div>
                    </div>
                  </div>
                )}

                {(lateDeductionSettings.late_deduction_type === "percentage") && (
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label>Percentage</label>
                      <div className="input-group">
                        <input type="number" className="form-control" name="late_deduction_percentage"
                          value={lateDeductionSettings.late_deduction_percentage} onChange={handleLateDeductionChange} />
                        <span className="input-group-text">%</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-check mb-4">
                  <input className="form-check-input" type="checkbox" name="late_deduction_multiple_occurrences"
                    checked={lateDeductionSettings.late_deduction_multiple_occurrences} onChange={handleLateDeductionChange} />
                  <label>Deduct for each late occurrence</label>
                </div>

                <div className="card bg-light">
                  <div className="card-body">
                    <h6>Preview (based on ₱86.87/hour)</h6>
                    <div className="row">
                      <div className="col-md-6">
                        <strong>Per occurrence:</strong>{" "}
                        {lateDeductionSettings.late_deduction_type === "time" && `₱${((lateDeductionSettings.late_deduction_minutes / 60) * 86.87).toFixed(2)}`}
                        {lateDeductionSettings.late_deduction_type === "fixed" && `₱${lateDeductionSettings.late_deduction_amount.toFixed(2)}`}
                        {lateDeductionSettings.late_deduction_type === "percentage" && `₱${((lateDeductionSettings.late_deduction_percentage / 100) * 86.87).toFixed(2)}`}
                      </div>
                      <div className="col-md-6">
                        <strong>Weekly max:</strong> {lateDeductionSettings.late_deduction_cap === 0 ? "No limit" : `${lateDeductionSettings.late_deduction_cap} occurrence(s)`}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="text-end mt-4">
              <button className="btn btn-warning" onClick={saveLateDeductionSettings} disabled={loading}>
                {loading ? "Saving..." : "Save Late Deduction Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== NIGHT SHIFT SECTION ==================== */}
      {activeSection === "night" && settings && (
        <div className="card shadow-sm">
          <div className="card-header bg-dark text-white">
            <h5 className="mb-0">🌙 Night Shift Configuration</h5>
          </div>
          <div className="card-body">
            <div className="form-check mb-4">
              <input className="form-check-input" type="checkbox" name="night_shift_enabled"
                checked={settings.night_shift_enabled} onChange={handleSettingChange} />
              <label className="form-check-label fw-bold">Enable Night Shift</label>
            </div>

            {settings.night_shift_enabled && (
              <>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label>Night Shift Start</label>
                    <input type="time" className="form-control" name="night_shift_start"
                      value={settings.night_shift_start || "22:00"} onChange={handleSettingChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label>Night Shift End</label>
                    <input type="time" className="form-control" name="night_shift_end"
                      value={settings.night_shift_end || "06:00"} onChange={handleSettingChange} />
                  </div>
                </div>

                <div className="card bg-light mt-3">
                  <div className="card-body">
                    <h6>🍽️ Night Shift Break</h6>
                    <div className="form-check mb-3">
                      <input className="form-check-input" type="checkbox" name="enabled"
                        checked={nightShiftBreak.enabled} onChange={(e) => setNightShiftBreak({...nightShiftBreak, enabled: e.target.checked})} />
                      <label>Enable Break for Night Shift</label>
                    </div>

                    {nightShiftBreak.enabled && (
                      <div className="row">
                        <div className="col-md-4 mb-3">
                          <label>Break Start</label>
                          <input type="time" className="form-control" name="start"
                            value={nightShiftBreak.start} onChange={(e) => setNightShiftBreak({...nightShiftBreak, start: e.target.value})} />
                        </div>
                        <div className="col-md-4 mb-3">
                          <label>Break End</label>
                          <input type="time" className="form-control" name="end"
                            value={nightShiftBreak.end} onChange={(e) => setNightShiftBreak({...nightShiftBreak, end: e.target.value})} />
                        </div>
                        <div className="col-md-4 mb-3">
                          <label>Duration</label>
                          <input type="number" className="form-control" value={nightShiftBreak.duration} disabled readOnly />
                          <small>minutes</small>
                        </div>
                        <div className="col-12">
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" name="unpaid"
                              checked={nightShiftBreak.unpaid} onChange={(e) => setNightShiftBreak({...nightShiftBreak, unpaid: e.target.checked})} />
                            <label>Unpaid Break</label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="text-end mt-4">
              <button className="btn btn-dark" onClick={saveSettings} disabled={loading}>
                {loading ? "Saving..." : "Save Night Shift Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyCalendar;
