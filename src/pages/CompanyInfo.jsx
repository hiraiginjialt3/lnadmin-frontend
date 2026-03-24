import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const CompanyInfo = () => {
  return (
    <div className="container-fluid p-0">

      {/* HERO SECTION */}
      <section className="bg-dark text-white text-center py-5">
        <div className="container">
          <h1 className="display-4 fw-bold">Our Company</h1>
          <p className="lead">
            Empowering innovation through technology and excellence.
          </p>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section className="py-5">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-md-6">
              <h2 className="fw-bold mb-3">About Us</h2>
              <p>
                We are a forward-thinking organization committed to delivering
                reliable and efficient solutions. Our team focuses on innovation,
                performance, and long-term partnerships.
              </p>
              <p>
                With strong leadership and skilled professionals, we aim to
                continuously improve and adapt to industry changes.
              </p>
            </div>
            <div className="col-md-6">
              <img
                src="https://via.placeholder.com/500x300"
                alt="Company"
                className="img-fluid rounded shadow"
              />
            </div>
          </div>
        </div>
      </section>

      {/* MISSION & VISION */}
      <section className="bg-light py-5">
        <div className="container text-center">
          <div className="row">
            <div className="col-md-6 mb-4">
              <div className="card shadow h-100">
                <div className="card-body">
                  <h4 className="fw-bold">Our Mission</h4>
                  <p>
                    To provide high-quality services that create value
                    and drive sustainable growth for our clients.
                  </p>
                </div>
              </div>
            </div>

            <div className="col-md-6 mb-4">
              <div className="card shadow h-100">
                <div className="card-body">
                  <h4 className="fw-bold">Our Vision</h4>
                  <p>
                    To become a trusted industry leader known for
                    innovation, integrity, and excellence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="py-5">
        <div className="container text-center">
          <h2 className="fw-bold mb-4">Our Services</h2>
          <div className="row">
            <div className="col-md-4 mb-3">
              <div className="card shadow h-100">
                <div className="card-body">
                  <h5>Consulting</h5>
                  <p>Strategic planning and business consulting solutions.</p>
                </div>
              </div>
            </div>

            <div className="col-md-4 mb-3">
              <div className="card shadow h-100">
                <div className="card-body">
                  <h5>Technology Solutions</h5>
                  <p>Modern software and system development services.</p>
                </div>
              </div>
            </div>

            <div className="col-md-4 mb-3">
              <div className="card shadow h-100">
                <div className="card-body">
                  <h5>Support Services</h5>
                  <p>Reliable customer and operational support.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT SECTION */}
      <section className="bg-dark text-white text-center py-4">
        <div className="container">
          <h5>Contact Us</h5>
          <p>Email: info@company.com | Phone: +63 900 000 0000</p>
          <p className="mb-0">© 2026 Company Name. All Rights Reserved.</p>
        </div>
      </section>

    </div>
  );
};

export default CompanyInfo;