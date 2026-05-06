import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface MonthlyBarChartProps {
  chartData: any[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ 
        backgroundColor: '#1e293b', 
        padding: '12px', 
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <p style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '12px' }}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color, margin: '4px 0', fontSize: '14px', fontWeight: 'bold' }}>
            {entry.name}: Rp {Number(entry.value).toLocaleString('id-ID')}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({ chartData }) => {
  console.log('Chart data received:', chartData);
  
  // Handle empty data
  if (!chartData || chartData.length === 0) {
    return (
      <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-muted">Belum ada data transaksi untuk ditampilkan.</p>
      </div>
    );
  }
  
  // Format month for display (e.g., "2026-05-15" -> "15 Mei", "2026-05" -> "Mei 2026")
  const formattedData = chartData.map(item => {
    if (!item.month) {
      return {
        ...item,
        displayMonth: 'Bulan Tidak Diketahui'
      };
    }

    const parts = item.month.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    
    let displayMonth = item.month;

    if (parts.length === 3) {
      // YYYY-MM-DD (Daily)
      const day = parts[2];
      const monthIdx = parseInt(parts[1]) - 1;
      displayMonth = `${day} ${monthNames[monthIdx]}`;
    } else if (parts.length === 2) {
      // YYYY-MM (Monthly)
      const monthIdx = parseInt(parts[1]) - 1;
      const year = parts[0];
      displayMonth = `${monthNames[monthIdx]} ${year}`;
    } else if (parts.length === 1 && parts[0].length === 4) {
      // YYYY (Yearly) - though usually we send YYYY-MM for yearly breakdown
      displayMonth = parts[0];
    }

    return {
      ...item,
      displayMonth
    };
  });
  
  return (
    <div style={{ height: '300px', width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis 
            dataKey="displayMonth" 
            tick={{ fontSize: 12, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={(value) => Number(value).toLocaleString('id-ID')}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => <span style={{ color: '#64748b', fontSize: '12px' }}>{value}</span>}
          />
          <Bar 
            dataKey="pemasukan" 
            name="Pemasukan"
            fill="#28a745" 
            radius={[4, 4, 0, 0]} 
            maxBarSize={50}
          />
          <Bar 
            dataKey="pengeluaran" 
            name="Pengeluaran"
            fill="#ff4d4d" 
            radius={[4, 4, 0, 0]}
            maxBarSize={50}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MonthlyBarChart;