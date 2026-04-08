import { useState, useCallback, useMemo } from 'react';

type TimeUnit = 'mingguan' | 'bulan' | 'tahunan';

const formatDate = (date: Date): string => date.toISOString().substring(0, 10);
const formatMonth = (date: Date): string => date.toISOString().substring(0, 7); 
const formatYear = (date: Date): string => date.getFullYear().toString();

const addMonths = (date: Date, months: number): Date => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

const addYears = (date: Date, years: number): Date => {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + years);
    return d;
};

const addDays = (date: Date, days: number): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};


export const useTimeFilter = (initialUnit: TimeUnit = 'bulan') => {
    const [unit, setUnit] = useState<TimeUnit>(initialUnit);
    const [currentDate, setCurrentDate] = useState(new Date());

    const navigate = useCallback((direction: 'prev' | 'next') => {
        const factor = direction === 'next' ? 1 : -1;
        
        setCurrentDate(prevDate => {
            switch (unit) {
                case 'mingguan':
                    // Navigasi per 7 hari
                    return addDays(prevDate, factor * 7);
                case 'bulan':
                    // Navigasi per bulan
                    return addMonths(prevDate, factor);
                case 'tahunan':
                    // Navigasi per tahun
                    return addYears(prevDate, factor);
                default:
                    return prevDate;
            }
        });
    }, [unit]);

    const changeUnit = useCallback((newUnit: TimeUnit) => {
        setUnit(newUnit);
        setCurrentDate(new Date()); 
    }, []);

    const period = useMemo(() => {
        switch (unit) {
            case 'mingguan': {
                const startOfWeek = new Date(currentDate);
                startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()); 
                const endOfWeek = addDays(startOfWeek, 6);
                
                return {
                    unit,
                    display: `${startOfWeek.toLocaleDateString('id-ID')} - ${endOfWeek.toLocaleDateString('id-ID')}`,
                    apiParam: {
                        start_date: formatDate(startOfWeek),
                        end_date: formatDate(endOfWeek),
                    }
                };
            }
            case 'bulan': {
                return {
                    unit,
                    display: currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
                    apiParam: {
                        month: formatMonth(currentDate), 
                    }
                };
            }
            case 'tahunan': {
                return {
                    unit,
                    display: formatYear(currentDate),
                    apiParam: {
                        year: formatYear(currentDate),
                    }
                };
            }
            default:
                return { unit, display: '', apiParam: {} };
        }
    }, [unit, currentDate]);

    return {
        unit,
        period,
        navigate,
        changeUnit,
    };
};