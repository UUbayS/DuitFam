import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface MonthlyBarChartProps {
  chartData: any[];
}

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false, 
    },
    title: {
      display: false,
    },
    tooltip: {
      backgroundColor: '#1e293b',
      padding: 12,
      bodySpacing: 4,
      callbacks: {
        label: function(context: any) {
          let label = context.dataset.label || '';
          if (label) { label += ': '; }
          if (context.parsed.y !== null) {
            label += new Intl.NumberFormat('id-ID', { 
                style: 'currency', 
                currency: 'IDR',
                maximumFractionDigits: 0 
            }).format(context.parsed.y);
          }
          return label;
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        display: false, 
      },
      ticks: {
        font: {
            family: "'Inter', sans-serif",
            weight: 'bold' as const,
        },
        color: '#64748b'
      }
    },
    y: {
      beginAtZero: true,
      border: {
        display: false, 
      },
      grid: {
        color: '#f1f5f9', 
      },
      ticks: {
        font: {
            family: "'Inter', sans-serif",
        },
        color: '#94a3b8',
        callback: function(value: any) {
          return new Intl.NumberFormat('id-ID', { 
              minimumFractionDigits: 0 
          }).format(value);
        }
      }
    }
  }
};

const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({ chartData }) => {
  const labels = chartData.map(d => d.label || d.month); 

  const data = {
    labels,
    datasets: [
      {
        label: 'Pemasukan',
        data: chartData.map(d => d.pemasukan),
        backgroundColor: '#28a745', 
        hoverBackgroundColor: '#218838',
        borderRadius: 10,
        borderSkipped: false as const,
        barPercentage: 0.6,
        categoryPercentage: 0.5,
      },
      {
        label: 'Pengeluaran',
        data: chartData.map(d => d.pengeluaran),
        backgroundColor: '#ff4d4d',
        hoverBackgroundColor: '#e60000',
        borderRadius: 10,
        borderSkipped: false as const,
        barPercentage: 0.6,
        categoryPercentage: 0.5,
      },
    ],
  };

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <Bar options={options} data={data} /> 
    </div>
  );
};

export default MonthlyBarChart;