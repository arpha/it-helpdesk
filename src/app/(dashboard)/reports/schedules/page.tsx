import { SchedulesClient } from "./_components/schedules-client";

export const metadata = {
    title: "Jadwal Laporan Rutin | SI-Mantap",
    description: "Kelola template jadwal laporan rutin Bulanan, Triwulanan, dan Tahunan",
};

export default function ReportSchedulesPage() {
    return <SchedulesClient />;
}
