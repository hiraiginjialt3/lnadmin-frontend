import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

const CompanyCalendar = () => {
  const [events, setEvents] = useState([
    { title: "Payroll Release", date: "2026-02-15", color: "#198754" },
    { title: "Company Meeting", date: "2026-02-20", color: "#0d6efd" },
    { title: "Team Building", date: "2026-02-25", color: "#fd7e14" }
  ]);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        // 1️⃣ Official Philippine public holidays
        const response = await fetch(
          "https://date.nager.at/api/v3/PublicHolidays/2026/PH"
        );
        const data = await response.json();
        const holidayEvents = data.map(holiday => ({
          title: holiday.localName,
          date: holiday.date,
          color: "#dc3545"
        }));

        // 2️⃣ Popular observances (not official holidays)
        const popularObservances = [
          { title: "Valentine's Day", date: "2026-02-14", color: "#ff69b4" },
          { title: "Halloween", date: "2026-10-31", color: "#ff7518" },
          { title: "Christmas Eve", date: "2026-12-24", color: "#ff0000" },
          { title: "Christmas Day", date: "2026-12-25", color: "#ff0000" },
          { title: "New Year's Eve", date: "2026-12-31", color: "#ffa500" }
        ];

        // Combine all events
        setEvents(prev => [...prev, ...holidayEvents, ...popularObservances]);
      } catch (error) {
        console.error("Failed to fetch holidays:", error);
      }
    };

    fetchHolidays();
  }, []);

  return (
    <div className="container mt-4">
      <h3 className="mb-3">Company Calendar</h3>
      <div className="card shadow-sm p-3">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          height="auto"
        />
      </div>
    </div>
  );
};

export default CompanyCalendar;
