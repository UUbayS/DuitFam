import { useState, useCallback, useMemo } from 'react';

type TimeUnit = 'mingguan' | 'bulan' | 'tahunan' | 'custom';

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

const todayIso = (): string => formatDate(new Date());
const daysAgoIso = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return formatDate(d);
};


export const useTimeFilter = (initialUnit: TimeUnit = 'bulan') => {
    const [unit, setUnit] = useState<TimeUnit>(initialUnit);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [customRange, setCustomRangeState] = useState<{ start: string; end: string }>({
        start: daysAgoIso(29),
        end: todayIso(),
    });

    const setCustomRange = useCallback((start: string, end: string) => {
        if (!start || !end) {
            setCustomRangeState({ start: daysAgoIso(29), end: todayIso() });
            return;
        }
        const s = start <= end ? start : end;
        const e = start <= end ? end : start;
        setCustomRangeState({ start: s, end: e });
    }, []);

    const navigate = useCallback((direction: 'prev' | 'next') => {
        const factor = direction === 'next' ? 1 : -1;

        setCurrentDate(prevDate => {
            switch (unit) {
                case 'mingguan':
                    return addDays(prevDate, factor * 7);
                case 'bulan':
                    return addMonths(prevDate, factor);
                case 'tahunan':
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
            case 'custom': {
                return {
                    unit,
                    display: `${customRange.start} – ${customRange.end}`,
                    apiParam: {
                        start_date: customRange.start,
                        end_date: customRange.end,
                    }
                };
            }
            default:
                return { unit, display: '', apiParam: {} };
        }
    }, [unit, currentDate, customRange]);

    return {
        unit,
        period,
        navigate,
        changeUnit,
        customRange,
        setCustomRange,
    };
};