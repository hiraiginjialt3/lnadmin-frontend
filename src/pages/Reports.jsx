import React from 'react';

const Reports = () => {
    return (
        <div className="page">
            <div className="page-header">
                <h1>Reports & Analytics</h1>
                <button className="btn btn-primary">
                    Generate Report
                </button>
            </div>
            <div className="page-content">
                <div className="card">
                    <h3>Reports Dashboard</h3>
                    <p>View violation statistics and generate reports.</p>
                    <p style={{ color: '#7f8c8d', marginTop: '20px' }}>
                        This page is under development. Features coming soon.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Reports;