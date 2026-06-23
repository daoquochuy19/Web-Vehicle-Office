import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Menu() {
  const navigate = useNavigate();

  return (
    <main className="page-shell menu-shell">
      <section className="menu-container">
        <div className="menu-header">
          <h1>Trang chủ</h1>
        </div>
        
        <div className="menu-items">
          <div className="menu-item" onClick={() => navigate('/my/vehicle-registration')}>
            <div className="menu-item-icon">
              <i className="fa-solid fa-car"></i>
            </div>
            <div className="menu-item-content">
              <h3>Thẻ xe</h3>
              <p>Đăng ký và quản lý thẻ xe</p>
            </div>
            <i className="fa-solid fa-chevron-right menu-item-arrow"></i>
          </div>

          <div className="menu-item menu-item-disabled">
            <div className="menu-item-icon">
              <i className="fa-solid fa-wallet"></i>
            </div>
            <div className="menu-item-content">
              <h3>Chi phí</h3>
              <p>Quản lý chi phí</p>
            </div>
            <i className="fa-solid fa-chevron-right menu-item-arrow"></i>
          </div>

          <div className="menu-item menu-item-disabled">
            <div className="menu-item-icon">
              <i className="fa-solid fa-calendar-check"></i>
            </div>
            <div className="menu-item-content">
              <h3>Ca làm việc</h3>
              <p>Quản lý ca làm việc</p>
            </div>
            <i className="fa-solid fa-chevron-right menu-item-arrow"></i>
          </div>
        </div>
      </section>
    </main>
  );
}
