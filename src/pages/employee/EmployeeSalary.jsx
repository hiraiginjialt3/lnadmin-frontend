import React, { useState, useEffect } from "react";
import { Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SalaryPage = () => {
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState("Week 6");
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchEmployeeSalary();
  }, []);

  const fetchEmployeeSalary = async () => {
    setLoading(true);
    try {
      // Get employee from localStorage
      const employeeData = localStorage.getItem('employee');
      if (!employeeData) {
        console.error('No employee data found');
        setLoading(false);
        return;
      }

      const employee = JSON.parse(employeeData);
      setEmployee(employee);

      // Fetch weekly payroll records for this employee
      const response = await fetch(`${API_URL}/api/payroll/employee/${employee.employee_id}`);
      const data = await response.json();

      if (data.success) {
        // Transform the data for the salary history format
        const formattedHistory = data.payrolls.map((payroll, index) => {
          // Calculate week number (you might want to calculate this properly)
          const weekNum = index + 1;
          
          return {
            week: `Week ${weekNum}`,
            week_start: payroll.week_start,
            week_end: payroll.week_end,
            net: payroll.net_pay || 0,
            gross: payroll.gross_pay || 0,
            deductions: payroll.total_deductions || 0,
            regular_hours: payroll.regular_hours || 0,
            overtime_hours: payroll.overtime_hours || 0,
            sunday_hours: payroll.sunday_hours || 0,
            holiday_hours: payroll.holiday_hours || 0,
            hourly_rate: payroll.hourly_rate || 0,
            regular_pay: payroll.regular_pay || 0,
            overtime_pay: payroll.overtime_pay || 0,
            sunday_pay: payroll.sunday_pay || 0,
            holiday_pay: payroll.holiday_pay || 0,
            sss: payroll.sss || 0,
            philhealth: payroll.philhealth || 0,
            pagibig: payroll.pagibig || 0,
            sss_loan: payroll.sss_loan || 0,
            pagibig_loan: payroll.pagibig_loan || 0,
            emergency_advance: payroll.emergency_advance || 0,
            other_deductions: payroll.other_deductions || 0,
            tax_withheld: payroll.tax_withheld || 0,
            status: payroll.status || 'pending'
          };
        });

        // Sort by date (newest first)
        formattedHistory.sort((a, b) => new Date(b.week_end) - new Date(a.week_end));
        
        setSalaryHistory(formattedHistory);
        
        // Set current week based on most recent payroll
        if (formattedHistory.length > 0) {
          setCurrentWeek(formattedHistory[0].week);
        }
      } else {
        console.error('Failed to fetch salary data:', data.message);
        // Fallback to empty array
        setSalaryHistory([]);
      }
    } catch (error) {
      console.error('Error fetching salary data:', error);
      setSalaryHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Get current data (most recent week)
  const currentData = salaryHistory.length > 0 
    ? salaryHistory[0] 
    : { net: 0, deductions: 0, gross: 0 };

  // Prepare chart data
  const lineData = {
    labels: salaryHistory.slice().reverse().map((s) => s.week),
    datasets: [
      {
        label: "Net Salary",
        data: salaryHistory.slice().reverse().map((s) => s.net),
        borderColor: "#0d6efd",
        backgroundColor: "rgba(13,110,253,0.2)",
        tension: 0.4,
        fill: true,
      },
      {
        label: "Gross Salary",
        data: salaryHistory.slice().reverse().map((s) => s.gross),
        borderColor: "#28a745",
        backgroundColor: "rgba(40,167,69,0.1)",
        tension: 0.4,
        fill: false,
        borderDash: [5, 5],
      },
    ],
  };

  const pieData = {
    labels: ["Net Salary", "Total Deductions"],
    datasets: [
      {
        data: [currentData.net, currentData.deductions],
        backgroundColor: ["#0d6efd", "#dc3545"],
      },
    ],
  };

  // Calculate YTD totals
  const totalIncomeYTD = salaryHistory.reduce(
    (acc, s) => acc + s.gross,
    0
  );
  const totalDeductionsYTD = salaryHistory.reduce(
    (acc, s) => acc + s.deductions, 
    0
  );
  const totalNetYTD = salaryHistory.reduce(
    (acc, s) => acc + s.net,
    0
  );

  // Simple forecast (average of last 3 weeks)
  const forecastNextWeek = salaryHistory.length >= 3
    ? Math.round(salaryHistory.slice(0, 3).reduce((acc, s) => acc + s.net, 0) / 3 * 1.02)
    : currentData.net;

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = salaryHistory.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(salaryHistory.length / itemsPerPage);

  const formatCurrency = (amount) => {
    return amount.toLocaleString("en-PH", { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="container-fluid vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading salary data...</p>
        </div>
      </div>
    );
  }

  if (salaryHistory.length === 0) {
    return (
      <div className="container-fluid vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <i className="bi bi-cash-stack fs-1 text-muted mb-3"></i>
          <h5>No Salary Records Found</h5>
          <p className="text-muted">
            {employee ? `No payroll records for ${employee.name}` : 'Please check back later'}
          </p>
          <button 
            className="btn btn-primary btn-sm mt-2"
            onClick={fetchEmployeeSalary}
          >
            <i className="bi bi-arrow-clockwise me-1"></i>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container-fluid vh-100 d-flex flex-column p-2"
      style={{ fontSize: "0.75rem" }}
    >
      {/* Employee Info Banner */}
      {employee && (
        <div className="alert alert-primary py-1 mb-2">
          <small>
            <i className="bi bi-person-circle me-1"></i>
            {employee.name} • {employee.department} • {employee.employee_id}
          </small>
        </div>
      )}

      {/* CURRENT SALARY */}
      <div className="card shadow-sm mb-2 flex-shrink-0 p-2">
        <div className="card-body p-2">
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="fw-bold mb-0">Current Salary</h2>
            <button 
              className="btn btn-sm btn-outline-primary"
              onClick={fetchEmployeeSalary}
            >
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
          <div className="d-flex justify-content-between align-items-end mt-1">
            <div>
              <h3 className="fw-bold text-primary mb-0">
                ₱ {formatCurrency(currentData.net)}
              </h3>
              <small className="text-muted">
                Gross: ₱ {formatCurrency(currentData.gross)}
              </small>
            </div>
            <div className="text-end">
              <small className="text-muted d-block">
                {salaryHistory[0]?.week_start && formatDate(salaryHistory[0].week_start)} - {salaryHistory[0]?.week_end && formatDate(salaryHistory[0].week_end)}
              </small>
              <span className={`badge ${currentData.status === 'paid' ? 'bg-success' : 'bg-warning'} mt-1`}>
                {currentData.status?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* VISUALIZATION */}
      <div className="row mb-2 flex-shrink-0">
        <div className="col-md-8 mb-2">
          <div className="card shadow-sm p-2">
            <div className="card-body p-1 d-flex flex-column">
              <h6 className="fw-bold mb-1">Weekly Salary Trend</h6>
              <div style={{ height: "150px" }}>
                <Line
                  data={lineData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { 
                        labels: { font: { size: 10 } },
                        position: 'top'
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            return `${context.dataset.label}: ₱ ${context.raw.toLocaleString()}`;
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        ticks: {
                          callback: (value) => `₱${value}`
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-2">
          <div className="card shadow-sm p-2">
            <div className="card-body p-1 d-flex flex-column">
              <h6 className="fw-bold mb-1">Current Week Breakdown</h6>
              <div style={{ height: "150px" }}>
                <Pie
                  data={pieData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { 
                        labels: { font: { size: 10 } },
                        position: 'bottom'
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const value = context.raw;
                            const total = currentData.net + currentData.deductions;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ₱ ${value.toLocaleString()} (${percentage}%)`;
                          }
                        }
                      }
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ADVANCED INSIGHTS */}
      <div className="row mb-2 flex-shrink-0">
        <div className="col-md-3 mb-1">
          <div className="card shadow-sm h-100 p-2 d-flex flex-column justify-content-center">
            <h6 className="mb-1">Total Gross YTD</h6>
            <p className="fw-bold mb-0 text-primary">
              ₱ {formatCurrency(totalIncomeYTD)}
            </p>
          </div>
        </div>
        <div className="col-md-3 mb-1">
          <div className="card shadow-sm h-100 p-2 d-flex flex-column justify-content-center">
            <h6 className="mb-1">Total Deductions YTD</h6>
            <p className="fw-bold mb-0 text-danger">
              ₱ {formatCurrency(totalDeductionsYTD)}
            </p>
          </div>
        </div>
        <div className="col-md-3 mb-1">
          <div className="card shadow-sm h-100 p-2 d-flex flex-column justify-content-center">
            <h6 className="mb-1">Total Net YTD</h6>
            <p className="fw-bold mb-0 text-success">
              ₱ {formatCurrency(totalNetYTD)}
            </p>
          </div>
        </div>
        <div className="col-md-3 mb-1">
          <div className="card shadow-sm h-100 p-2 d-flex flex-column justify-content-center">
            <h6 className="mb-1">Forecast Next Week</h6>
            <p className="fw-bold mb-0 text-info">
              ₱ {formatCurrency(forecastNextWeek)}
            </p>
          </div>
        </div>
      </div>

      {/* SALARY LIST */}
      <div className="accordion flex-shrink-1 mb-2" id="salaryAccordion">
        {currentItems.map((s, index) => {
          const collapseId = `collapse${index}`;
          return (
            <div className="card shadow-sm mb-1" key={index}>
              <div className="card-body p-2">
                <div
                  className="d-flex justify-content-between align-items-center"
                  data-bs-toggle="collapse"
                  data-bs-target={`#${collapseId}`}
                  aria-expanded="false"
                  style={{ cursor: "pointer" }}
                >
                  <div>
                    <h6 className="mb-0">
                      {s.week} {s.week_end && `(${formatDate(s.week_end)})`}
                    </h6>
                    <div className="d-flex gap-2">
                      <small className="text-muted">
                        {s.regular_hours}h reg • {s.overtime_hours}h OT
                      </small>
                      <span className={`badge ${s.status === 'paid' ? 'bg-success' : 'bg-warning'} py-0`}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <div className="text-end">
                      <span className="fw-bold text-primary d-block">
                        ₱ {formatCurrency(s.net)}
                      </span>
                      <small className="text-muted">
                        Gross: ₱ {formatCurrency(s.gross)}
                      </small>
                    </div>
                    <i className="bi bi-chevron-down"></i>
                  </div>
                </div>

                <div
                  id={collapseId}
                  className="collapse mt-2"
                  data-bs-parent="#salaryAccordion"
                >
                  <div className="row">
                    <div className="col-md-6">
                      <h6 className="fw-bold mb-1">Hours Breakdown</h6>
                      <div className="d-flex justify-content-between">
                        <span>Regular ({s.regular_hours}h):</span>
                        <span>₱ {formatCurrency(s.regular_pay)}</span>
                      </div>
                      {s.overtime_hours > 0 && (
                        <div className="d-flex justify-content-between">
                          <span>OT ({s.overtime_hours}h @ 1.25x):</span>
                          <span>₱ {formatCurrency(s.overtime_pay)}</span>
                        </div>
                      )}
                      {s.sunday_hours > 0 && (
                        <div className="d-flex justify-content-between">
                          <span>Sunday ({s.sunday_hours}h @ 1.30x):</span>
                          <span>₱ {formatCurrency(s.sunday_pay)}</span>
                        </div>
                      )}
                      {s.holiday_hours > 0 && (
                        <div className="d-flex justify-content-between">
                          <span>Holiday ({s.holiday_hours}h @ 2.00x):</span>
                          <span>₱ {formatCurrency(s.holiday_pay)}</span>
                        </div>
                      )}
                      <hr className="my-1" />
                      <div className="d-flex justify-content-between fw-bold">
                        <span>Gross Pay:</span>
                        <span className="text-success">₱ {formatCurrency(s.gross)}</span>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <h6 className="fw-bold mb-1">Deductions</h6>
                      {s.sss > 0 && (
                        <div className="d-flex justify-content-between">
                          <span>SSS:</span>
                          <span>₱ {formatCurrency(s.sss)}</span>
                        </div>
                      )}
                      {s.philhealth > 0 && (
                        <div className="d-flex justify-content-between">
                          <span>PhilHealth:</span>
                          <span>₱ {formatCurrency(s.philhealth)}</span>
                        </div>
                      )}
                      {s.pagibig > 0 && (
                        <div className="d-flex justify-content-between">
                          <span>Pag-IBIG:</span>
                          <span>₱ {formatCurrency(s.pagibig)}</span>
                        </div>
                      )}
                      {s.tax_withheld > 0 && (
                        <div className="d-flex justify-content-between">
                          <span>Tax:</span>
                          <span>₱ {formatCurrency(s.tax_withheld)}</span>
                        </div>
                      )}
                      {s.emergency_advance > 0 && (
                        <div className="d-flex justify-content-between">
                          <span>Emergency Advance:</span>
                          <span>₱ {formatCurrency(s.emergency_advance)}</span>
                        </div>
                      )}
                      {s.other_deductions > 0 && (
                        <div className="d-flex justify-content-between">
                          <span>Other:</span>
                          <span>₱ {formatCurrency(s.other_deductions)}</span>
                        </div>
                      )}
                      <hr className="my-1" />
                      <div className="d-flex justify-content-between fw-bold">
                        <span>Total Deductions:</span>
                        <span className="text-danger">-₱ {formatCurrency(s.deductions)}</span>
                      </div>
                      <div className="d-flex justify-content-between fw-bold mt-1">
                        <span>Net Pay:</span>
                        <span className="text-primary">₱ {formatCurrency(s.net)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mt-2">
                    <small className="text-muted">
                      Week: {s.week_start && formatDate(s.week_start)} - {s.week_end && formatDate(s.week_end)}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <nav className="flex-shrink-0">
          <ul className="pagination pagination-sm justify-content-center mb-0">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button 
                className="page-link"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                &laquo;
              </button>
            </li>
            {[...Array(totalPages).keys()].map(num => (
              <li key={num + 1} className={`page-item ${currentPage === num + 1 ? 'active' : ''}`}>
                <button 
                  className="page-link"
                  onClick={() => setCurrentPage(num + 1)}
                >
                  {num + 1}
                </button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button 
                className="page-link"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                &raquo;
              </button>
            </li>
          </ul>
          <div className="text-center mt-1">
            <small className="text-muted">
              Page {currentPage} of {totalPages}
            </small>
          </div>
        </nav>
      )}
    </div>
  );
};

export default SalaryPage;