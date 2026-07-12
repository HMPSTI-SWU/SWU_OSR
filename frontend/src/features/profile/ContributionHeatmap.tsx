'use client';

interface ContributionHeatmapProps {
  contributionDays: Record<string, number> | undefined;
}

function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getMonthLabel(date: Date): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return months[date.getMonth()];
}

export function ContributionHeatmap({ contributionDays }: ContributionHeatmapProps) {
  const weeks = 20;

  // Build date grid: last N weeks ending today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the start date aligned to Sunday
  const endDate = new Date(today);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - weeks * 7 + 1);
  const dayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - dayOfWeek);

  // Build the grid
  const grid: { date: string; count: number; level: number }[][] = [];
  const monthLabels: { label: string; weekIdx: number }[] = [];
  let lastMonth = -1;

  const currentDate = new Date(startDate);
  for (let w = 0; w < weeks; w++) {
    const week: { date: string; count: number; level: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = formatDate(currentDate);
      const count = contributionDays?.[dateStr] ?? 0;
      week.push({ date: dateStr, count, level: getLevel(count) });

      // Track month labels (only on first day of each week)
      if (d === 0 && currentDate.getMonth() !== lastMonth) {
        lastMonth = currentDate.getMonth();
        monthLabels.push({ label: getMonthLabel(currentDate), weekIdx: w });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
    grid.push(week);
  }

  const hasAnyData = Object.keys(contributionDays ?? {}).length > 0;

  return (
    <div className="overflow-x-auto">
      {/* Month labels row */}
      <div className="relative h-4 mb-1" style={{ width: `${weeks * 14}px` }}>
        {monthLabels.map((m, i) => (
          <span
            key={i}
            className="absolute text-[10px] text-gray-400 dark:text-white"
            style={{ left: `${m.weekIdx * 14}px` }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="inline-flex gap-0.5">
        {grid.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-0.5">
            {week.map((day, dayIdx) => (
              <div
                key={dayIdx}
                className={`heatmap-cell w-3 h-3 heatmap-level-${day.level}`}
                title={`${day.date}: ${day.count} contribution${day.count !== 1 ? 's' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-2">
        {!hasAnyData && (
          <span className="text-[10px] text-gray-400 dark:text-white">
            Click &quot;Sync from GitHub&quot; to populate activity data
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-gray-400 dark:text-white mr-1">Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div key={level} className={`w-3 h-3 rounded-sm heatmap-level-${level}`} />
          ))}
          <span className="text-[10px] text-gray-400 dark:text-white ml-1">More</span>
        </div>
      </div>
    </div>
  );
}
