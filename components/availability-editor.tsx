"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveMyAvailability } from "@/app/actions/availability"
import { WEEKDAYS, type DayAvailability } from "@/lib/availability"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Check, Loader2 } from "lucide-react"

export function AvailabilityEditor({
  initialWeek,
}: {
  initialWeek: DayAvailability[]
}) {
  const [week, setWeek] = useState<DayAvailability[]>(initialWeek)
  const [isPending, startTransition] = useTransition()

  function updateDay(dayOfWeek: number, patch: Partial<DayAvailability>) {
    setWeek((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)),
    )
  }

  function handleSave() {
    // Guard: enabled days need a valid range.
    const invalid = week.find((d) => d.enabled && d.endTime <= d.startTime)
    if (invalid) {
      const label = WEEKDAYS.find((w) => w.value === invalid.dayOfWeek)?.label
      toast.error("Invalid time range", {
        description: `${label}'s end time must be after its start time.`,
      })
      return
    }
    startTransition(async () => {
      const result = await saveMyAvailability(week)
      if (result.ok) {
        toast.success("Availability saved", {
          description: "Dancers can now book within these hours.",
        })
      } else {
        toast.error("Couldn't save availability", {
          description: result.error,
        })
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {week.map((day) => {
            const label =
              WEEKDAYS.find((w) => w.value === day.dayOfWeek)?.label ?? ""
            return (
              <div
                key={day.dayOfWeek}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(checked) =>
                      updateDay(day.dayOfWeek, { enabled: checked })
                    }
                    aria-label={`Toggle availability on ${label}`}
                  />
                  <span
                    className={cn(
                      "w-24 font-medium",
                      !day.enabled && "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </div>

                {day.enabled ? (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor={`start-${day.dayOfWeek}`}
                        className="sr-only"
                      >
                        {label} start time
                      </Label>
                      <Input
                        id={`start-${day.dayOfWeek}`}
                        type="time"
                        step={3600}
                        value={day.startTime}
                        onChange={(e) =>
                          updateDay(day.dayOfWeek, { startTime: e.target.value })
                        }
                        className="w-32"
                      />
                    </div>
                    <span className="text-muted-foreground">to</span>
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor={`end-${day.dayOfWeek}`}
                        className="sr-only"
                      >
                        {label} end time
                      </Label>
                      <Input
                        id={`end-${day.dayOfWeek}`}
                        type="time"
                        step={3600}
                        value={day.endTime}
                        onChange={(e) =>
                          updateDay(day.dayOfWeek, { endTime: e.target.value })
                        }
                        className="w-32"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Unavailable
                  </span>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Dancers can book hourly sessions within these windows.
        </p>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Save availability
        </Button>
      </div>
    </div>
  )
}
