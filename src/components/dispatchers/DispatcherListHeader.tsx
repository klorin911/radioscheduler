import React from 'react';

interface Props {
  count: number;
  total: number;
}

const DispatcherListHeader: React.FC<Props> = ({ count, total }) => {
  return (
    <div className="dispatchers-list-header">
      <h2 className="header-title">
        Dispatchers <span className="header-count">({count}/{total})</span>
      </h2>
    </div>
  );
};

export default DispatcherListHeader;
