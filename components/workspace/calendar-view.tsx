"use client";
import type { Entry, Project, Snapshot } from "@/lib/schema";
import { dateKey, localInput, nextDay } from "@/lib/time";
import frLocale from "@fullcalendar/core/locales/fr";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useEffect, useRef } from "react";
import { type Setter } from "./types";
export function CalendarView({
  data,
  filtered,
  projectById,
  from,
  now,
  today,
  zone,
  editEntry,
  newEntry,
  setFrom,
  setTo,
}: {
  data: Snapshot;
  filtered: Entry[];
  projectById: Record<string, Project>;
  from: string;
  now: number;
  today: string;
  zone: string;
  editEntry: (entry: Entry) => void;
  newEntry: (start?: string) => void;
  setFrom: Setter<string>;
  setTo: Setter<string>;
}) {
  const calendarRef = useRef<FullCalendar>(null);
  useEffect(() => {
    const calendar = calendarRef.current?.getApi();
    if (!calendar || !from) return;
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const first = dateKey(calendar.view.activeStart, localZone);
    const last = dateKey(calendar.view.activeEnd, localZone);
    if (from < first || from >= last) calendar.gotoDate(from);
  }, [from]);
  return (
    <section className="calendar-card">
      <div className="calendar-note">
        <span>
          Cliquez sur un créneau pour le modifier, ou sur une date pour ajouter
          du temps.
        </span>
        <span>{zone}</span>
      </div>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locale={frLocale}
        buttonIcons={false}
        buttonText={{ prev: "Préc.", next: "Suiv." }}
        initialView="timeGridWeek"
        initialDate={today}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        height="auto"
        allDaySlot={false}
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        scrollTime="07:00:00"
        now={localInput(now, zone)}
        firstDay={1}
        events={filtered.map((e) => ({
          id: e.id,
          title: `${e.description} · ${projectById[e.projectId]?.name}`,
          start: localInput(e.start, zone, true),
          end: localInput(e.end, zone, true),
          backgroundColor: projectById[e.projectId]?.color,
          borderColor: projectById[e.projectId]?.color,
        }))}
        eventClick={(info) => {
          const entry = data.entries.find((e) => e.id === info.event.id);
          if (entry) editEntry(entry);
        }}
        dateClick={(info) => {
          if (data.projects.some((p) => !p.archived))
            newEntry(
              info.dateStr.length === 10
                ? `${info.dateStr}T09:00`
                : info.dateStr.slice(0, 16),
            );
        }}
        datesSet={(info) => {
          const start = dateKey(
            info.start,
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          );
          const end = nextDay(
            dateKey(info.end, Intl.DateTimeFormat().resolvedOptions().timeZone),
            -1,
          );
          setFrom(start);
          setTo(end);
        }}
      />
    </section>
  );
}
