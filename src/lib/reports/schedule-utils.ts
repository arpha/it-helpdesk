import {
    INDONESIAN_MONTHS,
    type ReportDeadlineRule,
    type ReportSchedule,
    type ReportScheduleFrequency,
} from "@/types/report";

export interface ScheduleOccurrence {
    periodKey: string;
    periodLabel: string;
    title: string;
    periodStart: string; // YYYY-MM-DD
    periodEnd: string; // YYYY-MM-DD
    deadline: string; // YYYY-MM-DD
    generateOnDate: string; // YYYY-MM-DD
}

export function getTodayWibYmd(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

function daysInMonth(year: number, month1Based: number): number {
    return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

function formatYmd(year: number, month1Based: number, day: number): string {
    const clampedDay = Math.min(Math.max(1, day), daysInMonth(year, month1Based));
    return `${year}-${String(month1Based).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

function addDaysYmd(ymd: string, deltaDays: number): string {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    dt.setUTCDate(dt.getUTCDate() + deltaDays);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
        dt.getUTCDate()
    ).padStart(2, "0")}`;
}

function buildOccurrenceForMonthly(
    schedule: Pick<
        ReportSchedule,
        "title_template" | "deadline_rule" | "deadline_day" | "generate_days_before"
    >,
    year: number,
    month1Based: number
): ScheduleOccurrence {
    const periodKey = `${year}-${String(month1Based).padStart(2, "0")}`;
    const periodLabel = `${INDONESIAN_MONTHS[month1Based - 1]} ${year}`;
    const periodStart = formatYmd(year, month1Based, 1);
    const periodEnd = formatYmd(year, month1Based, daysInMonth(year, month1Based));

    let deadline: string;
    if (schedule.deadline_rule === "end_of_period") {
        deadline = periodEnd;
    } else if (schedule.deadline_rule === "next_month_day") {
        const nextMonth = month1Based === 12 ? 1 : month1Based + 1;
        const nextYear = month1Based === 12 ? year + 1 : year;
        deadline = formatYmd(nextYear, nextMonth, schedule.deadline_day);
    } else {
        deadline = formatYmd(year, month1Based, schedule.deadline_day);
    }

    const generateOnDate = addDaysYmd(deadline, -Math.max(0, schedule.generate_days_before));
    const title = `${schedule.title_template} — ${periodLabel}`;

    return { periodKey, periodLabel, title, periodStart, periodEnd, deadline, generateOnDate };
}

function buildOccurrenceForQuarterly(
    schedule: Pick<
        ReportSchedule,
        "title_template" | "deadline_rule" | "deadline_day" | "generate_days_before"
    >,
    year: number,
    quarter: 1 | 2 | 3 | 4
): ScheduleOccurrence {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    const periodKey = `${year}-Q${quarter}`;
    const periodLabel = `Triwulan ${quarter} ${year}`;
    const periodStart = formatYmd(year, startMonth, 1);
    const periodEnd = formatYmd(year, endMonth, daysInMonth(year, endMonth));

    let deadline: string;
    if (schedule.deadline_rule === "next_month_day") {
        const nextMonth = endMonth === 12 ? 1 : endMonth + 1;
        const nextYear = endMonth === 12 ? year + 1 : year;
        deadline = formatYmd(nextYear, nextMonth, schedule.deadline_day);
    } else if (schedule.deadline_rule === "fixed_day") {
        deadline = formatYmd(year, endMonth, schedule.deadline_day);
    } else {
        deadline = periodEnd;
    }

    const generateOnDate = addDaysYmd(deadline, -Math.max(0, schedule.generate_days_before));
    const title = `${schedule.title_template} — ${periodLabel}`;

    return { periodKey, periodLabel, title, periodStart, periodEnd, deadline, generateOnDate };
}

function buildOccurrenceForYearly(
    schedule: Pick<
        ReportSchedule,
        | "title_template"
        | "deadline_rule"
        | "deadline_day"
        | "deadline_month"
        | "generate_days_before"
    >,
    year: number
): ScheduleOccurrence {
    const periodKey = `${year}`;
    const periodLabel = `Tahun ${year}`;
    const periodStart = formatYmd(year, 1, 1);
    const periodEnd = formatYmd(year, 12, 31);
    const targetMonth = schedule.deadline_month || 12;

    let deadline: string;
    if (schedule.deadline_rule === "end_of_period") {
        deadline = periodEnd;
    } else if (schedule.deadline_rule === "next_month_day") {
        deadline = formatYmd(year + 1, targetMonth, schedule.deadline_day);
    } else {
        deadline = formatYmd(year, targetMonth, schedule.deadline_day);
    }

    const generateOnDate = addDaysYmd(deadline, -Math.max(0, schedule.generate_days_before));
    const title = `${schedule.title_template} — ${periodLabel}`;

    return { periodKey, periodLabel, title, periodStart, periodEnd, deadline, generateOnDate };
}

export function getCandidateOccurrences(
    schedule: Pick<
        ReportSchedule,
        | "title_template"
        | "frequency"
        | "deadline_rule"
        | "deadline_day"
        | "deadline_month"
        | "generate_days_before"
    >,
    referenceYmd?: string
): ScheduleOccurrence[] {
    const ref = referenceYmd || getTodayWibYmd();
    const [year, month] = ref.split("-").map(Number);

    if (schedule.frequency === "monthly") {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;

        return [
            buildOccurrenceForMonthly(schedule, prevYear, prevMonth),
            buildOccurrenceForMonthly(schedule, year, month),
            buildOccurrenceForMonthly(schedule, nextYear, nextMonth),
        ];
    }

    if (schedule.frequency === "quarterly") {
        const currentQuarter = (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
        const prevQuarter = (currentQuarter === 1 ? 4 : currentQuarter - 1) as 1 | 2 | 3 | 4;
        const prevYear = currentQuarter === 1 ? year - 1 : year;
        const nextQuarter = (currentQuarter === 4 ? 1 : currentQuarter + 1) as 1 | 2 | 3 | 4;
        const nextYear = currentQuarter === 4 ? year + 1 : year;

        return [
            buildOccurrenceForQuarterly(schedule, prevYear, prevQuarter),
            buildOccurrenceForQuarterly(schedule, year, currentQuarter),
            buildOccurrenceForQuarterly(schedule, nextYear, nextQuarter),
        ];
    }

    return [
        buildOccurrenceForYearly(schedule, year - 1),
        buildOccurrenceForYearly(schedule, year),
        buildOccurrenceForYearly(schedule, year + 1),
    ];
}

export function getNextOccurrencePreview(
    schedule: Pick<
        ReportSchedule,
        | "title_template"
        | "frequency"
        | "deadline_rule"
        | "deadline_day"
        | "deadline_month"
        | "generate_days_before"
    >,
    referenceYmd?: string
): ScheduleOccurrence {
    const ref = referenceYmd || getTodayWibYmd();
    const candidates = getCandidateOccurrences(schedule, ref);
    return candidates.find((c) => c.deadline >= ref) || candidates[1];
}

export function describeDeadlineRule(params: {
    frequency: ReportScheduleFrequency;
    deadline_rule: ReportDeadlineRule;
    deadline_day: number;
    deadline_month?: number | null;
}): string {
    const { frequency, deadline_rule, deadline_day, deadline_month } = params;
    const monthName = INDONESIAN_MONTHS[(deadline_month || 12) - 1] || "Desember";

    if (frequency === "monthly") {
        if (deadline_rule === "end_of_period") return "Setiap akhir bulan";
        if (deadline_rule === "next_month_day") return `Tgl ${deadline_day} bulan berikutnya`;
        return `Setiap tanggal ${deadline_day}`;
    }

    if (frequency === "quarterly") {
        if (deadline_rule === "next_month_day") {
            return `Tgl ${deadline_day} bulan setelah triwulan (Apr, Jul, Okt, Jan)`;
        }
        if (deadline_rule === "fixed_day") {
            return `Tgl ${deadline_day} bulan akhir triwulan`;
        }
        return "Akhir triwulan (31 Mar, 30 Jun, 30 Sep, 31 Des)";
    }

    if (deadline_rule === "end_of_period") return "Setiap 31 Desember";
    if (deadline_rule === "next_month_day") {
        return `Setiap ${deadline_day} ${monthName} tahun berikutnya`;
    }
    return `Setiap ${deadline_day} ${monthName}`;
}
