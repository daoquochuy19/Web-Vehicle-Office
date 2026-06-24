import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from '../assets/images/hapulico-logo.jpg';

export default function Menu() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('vehicle');

  const handleLogout = () => {
    localStorage.removeItem('loggedIn');
    navigate('/');
  };

  return (
    <div className="dashboard-shell">
      {/* Left Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="dashboard-logo">
          <img src={logoImg} alt="Hapulico Logo" />
        </div>
        <nav className="dashboard-nav">
          <div
            className={`dashboard-nav-item ${activeNav === 'vehicle' ? 'active' : ''}`}
            onClick={() => setActiveNav('vehicle')}
          >
            <div className="dashboard-nav-item-icon">
              <i className="fa-solid fa-car"></i>
            </div>
            <span>Thẻ xe</span>
          </div>
          <div className="dashboard-nav-item disabled">
            <div className="dashboard-nav-item-icon">
              <i className="fa-solid fa-wallet"></i>
            </div>
            <span>Chi phí</span>
          </div>
          <div className="dashboard-nav-item disabled">
            <div className="dashboard-nav-item-icon">
              <i className="fa-solid fa-calendar-check"></i>
            </div>
            <span>Ca làm việc</span>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <div>
              <h1 className="dashboard-header-title">Đăng ký thẻ xe</h1>
            </div>
          </div>
          <div className="dashboard-header-right">
            <button className="logout-btn" onClick={handleLogout}>
              <i className="fa-solid fa-sign-out-alt"></i>
              Đăng xuất
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '20px' }}>
            <button className="btn-secondary" onClick={() => navigate('/my/vehicle-registration', { state: { mode: 'excel' } })}>
              <i className="fa-solid fa-file-excel"></i>
              Thao tác excel
            </button>
            <button className="btn-primary" onClick={() => navigate('/my/vehicle-registration', { state: { mode: 'manual' } })}>
              <i className="fa-solid fa-plus"></i>
              Thêm mới
            </button>
          </div>

          {/* Filters */}
          <div className="dashboard-filters">
            <select className="filter-select">
              <option>Hình thức đăng ký</option>
              <option>Cấp mới</option>
              <option>Đổi biển kiểm soát</option>
            </select>
            <select className="filter-select">
              <option>Trạng thái</option>
              <option>Chờ tiếp nhận</option>
              <option>Đang xử lý</option>
              <option>Hoàn thành</option>
            </select>
            <select className="filter-select">
              <option>Mặt bằng</option>
            </select>
            <select className="filter-select">
              <option>Ngày đăng ký</option>
            </select>
          </div>

          {/* Table */}
          <div className="dashboard-table-container">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Hình thức đăng ký</th>
                  <th>Ngày đăng ký</th>
                  <th>Số hợp đồng</th>
                  <th>Mặt bằng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {/* Data will be added later via API */}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
