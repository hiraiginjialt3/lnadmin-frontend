import React from "react";
import { Link } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";


const GovInfo = ({ user }) => {
  return (
    <>
      {/* Header Banner */}
      <header className="header-banner d-flex align-items-center">
        <Link to="/" className="header-logo text-white text-decoration-none">
          LN Display
        </Link>
      </header>

      {/* Main Content */}
      <main className="container my-5">
        <div className="d-flex flex-column flex-lg-row min-vh-100">
          {/* Page Content */}
          <div className="flex-grow-1 p-3">
            <div className="row g-3">

              {/* SSS */}
              <div className="col-12 col-md-6 col-lg-3">
                <a 
                  href="https://www.sss.gov.ph/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-decoration-none"
                >
                  <div className="card border-success h-100 text-center gov-card">
                    <div className="card-body py-4">
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Social_Security_System_%28SSS%29.svg/1280px-Social_Security_System_%28SSS%29.svg.png"
                        alt="SSS"
                        className="gov-icon mb-2"
                      />
                      <p className="mb-1 fw-bold">{user?.sss}</p>
                      <small className="text-muted">
                        Social Security System
                      </small>
                      <p className="mt-2 text-secondary small">
                        Provides benefits for retirement, sickness, and disability.
                      </p>
                    </div>
                  </div>
                </a>
              </div>



              {/* PhilHealth */}
              <div className="col-12 col-md-6 col-lg-3">
                <a
                  href="https://www.philhealth.gov.ph/about_us/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-decoration-none"
                >
                  <div className="card border-info h-100 text-center gov-card">
                    <div className="card-body py-4">
                      <img
                        src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQVGHv88Dhro5ErdoJzhwxC4NeQtCLKeBQzgA&s"
                        alt="PhilHealth"
                        className="gov-icon mb-2"
                      />
                      <p className="mb-1 fw-bold">{user?.philhealth}</p>
                      <small className="text-muted">Philhealth</small>
                      <p className="mt-2 text-secondary small">
                        Covers medical and healthcare benefits for members.
                      </p>
                    </div>
                  </div>
                </a>
              </div>


              {/* Pag-IBIG */}
              <div className="col-12 col-md-6 col-lg-3">
                <a
                  href="https://www.pagibigfund.gov.ph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-decoration-none"
                >
                  <div className="card border-warning h-100 text-center gov-card">
                    <div className="card-body py-4">
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Pag-IBIG.svg/500px-Pag-IBIG.svg.png"
                        alt="Pag-IBIG"
                        className="gov-icon mb-2"
                      />
                      <p className="mb-1 fw-bold">{user?.pagibig}</p>
                      <small className="text-muted">Pag-IBIG Fund</small>
                      <p className="mt-2 text-secondary small">
                        Offers housing loans and savings programs for members.
                      </p>
                    </div>
                  </div>
                </a>
              </div>



            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-3">
        <div>&copy; All rights reserved 2026</div>
        <div>Developed by: Parokya ni Pura Group</div>
      </footer>
    </>
  );
};

export default GovInfo;
