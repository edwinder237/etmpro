"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search,
  Sun,
  Moon,
  Settings,
  Plus,
  MoreVertical,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  Info,
  CalendarDays,
  CalendarRange,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Check,
  Share2,
  Download,
  Repeat,
  Edit3,
  ChevronDown,
  ChevronUp,
  Circle,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  MapPin,
  Loader2,
  GripVertical,
  Target,
  Copy
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isToday,
  startOfDay,
  endOfDay
} from "date-fns";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import { addToCalendar, type CalendarProvider } from "~/lib/calendar-export";
import toast, { Toaster } from "react-hot-toast";
import { UserButton, useUser } from "@clerk/nextjs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { TaskIcon } from "~/components/icons/TaskIcon";
import { EisenqLogo } from "~/components/icons/EisenqLogo";
import { StatCardSkeleton, QuadrantSkeleton, TaskCardSkeleton } from "~/components/skeletons/TaskSkeleton";
import { useAudioFeedback } from "~/hooks/useAudioFeedback";

type TaskQuadrant = "urgent-important" | "important-not-urgent" | "urgent-not-important" | "not-urgent-not-important";
type TaskPriority = "high" | "medium" | "low";
type TaskStatus = "pending" | "in-progress" | "completed";
type CalendarView = "day" | "week" | "month";

interface Task {
  _id: string;
  title: string;
  description?: string;
  quadrant: TaskQuadrant;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  duration?: number;
  createdAt: string;
  updatedAt: string;
  parentTaskId?: string;
  goalId?: string;
  subtaskCount?: number;
  subtaskCompletedCount?: number;
}

type GoalPeriodType = "week" | "month";
type GoalStatus = "active" | "achieved" | "dropped";

interface Goal {
  _id: string;
  title: string;
  note?: string;
  periodType: GoalPeriodType;
  periodKey: string;
  status: GoalStatus;
  parentGoalId?: string;
  createdAt: string;
  updatedAt: string;
}


type ChecklistFrequency = "daily" | "weekly";

interface ChecklistItem {
  _id: string;
  title: string;
  frequency: ChecklistFrequency;
  daysOfWeek?: number[];
  completedDates: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceItem {
  _id: string;
  title: string;
  intervalDays: number;
  lastCompletedDate?: string;
  nextDueDate: string;
}

interface PaymentLineItem {
  label: string;
  amount: number;
}

interface PaymentAccount {
  id: string;
  shortName: string;
  total: number;
  items: PaymentLineItem[];
}

interface PaymentsDueData {
  configured: boolean;
  date?: string;
  totalIncome?: number;
  finalBalance?: number;
  accounts?: PaymentAccount[];
  budgets?: PaymentLineItem[];
}

const INTERVAL_PRESETS = [
  { label: "Monthly", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "Yearly", days: 365 },
] as const;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const quadrantConfig = {
  "urgent-important": {
    title: "Do First",
    subtitle: "Urgent & Important",
    color: "bg-red-600",
    borderColor: "border-red-600",
    bgColor: "bg-red-600/10"
  },
  "important-not-urgent": {
    title: "Schedule",
    subtitle: "Important & Not Urgent",
    color: "bg-yellow-600",
    borderColor: "border-yellow-600",
    bgColor: "bg-yellow-600/10"
  },
  "urgent-not-important": {
    title: "Delegate",
    subtitle: "Urgent & Not Important",
    color: "bg-blue-600",
    borderColor: "border-blue-600",
    bgColor: "bg-blue-600/10"
  },
  "not-urgent-not-important": {
    title: "Eliminate",
    subtitle: "Not Urgent & Not Important",
    color: "bg-green-600",
    borderColor: "border-green-600",
    bgColor: "bg-green-600/10"
  }
};

const WEATHER_CODE_MAP: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "sun" },
  1: { label: "Mostly clear", icon: "sun" },
  2: { label: "Partly cloudy", icon: "cloud" },
  3: { label: "Overcast", icon: "cloud" },
  45: { label: "Foggy", icon: "fog" },
  48: { label: "Rime fog", icon: "fog" },
  51: { label: "Light drizzle", icon: "drizzle" },
  53: { label: "Drizzle", icon: "drizzle" },
  55: { label: "Dense drizzle", icon: "drizzle" },
  61: { label: "Light rain", icon: "rain" },
  63: { label: "Rain", icon: "rain" },
  65: { label: "Heavy rain", icon: "rain" },
  71: { label: "Light snow", icon: "snow" },
  73: { label: "Snow", icon: "snow" },
  75: { label: "Heavy snow", icon: "snow" },
  77: { label: "Snow grains", icon: "snow" },
  80: { label: "Light showers", icon: "rain" },
  81: { label: "Showers", icon: "rain" },
  82: { label: "Heavy showers", icon: "rain" },
  85: { label: "Snow showers", icon: "snow" },
  86: { label: "Heavy snow showers", icon: "snow" },
  95: { label: "Thunderstorm", icon: "lightning" },
  96: { label: "Thunderstorm + hail", icon: "lightning" },
  99: { label: "Thunderstorm + heavy hail", icon: "lightning" },
};

function WeatherIcon({ icon, className }: { icon: string; className?: string }) {
  switch (icon) {
    case "sun": return <Sun className={className} />;
    case "cloud": return <Cloud className={className} />;
    case "rain": return <CloudRain className={className} />;
    case "snow": return <CloudSnow className={className} />;
    case "drizzle": return <CloudDrizzle className={className} />;
    case "fog": return <CloudFog className={className} />;
    case "lightning": return <CloudLightning className={className} />;
    default: return <Cloud className={className} />;
  }
}

function getClothingSuggestion(feelsLike: number, weatherCode: number): string[] {
  const tips: string[] = [];

  // Temperature-based
  if (feelsLike <= -15) {
    tips.push("Heavy winter coat, insulated boots, gloves & scarf");
  } else if (feelsLike <= -5) {
    tips.push("Winter coat, warm layers, hat & gloves");
  } else if (feelsLike <= 5) {
    tips.push("Warm jacket, long sleeves, consider layers");
  } else if (feelsLike <= 12) {
    tips.push("Light jacket or sweater");
  } else if (feelsLike <= 18) {
    tips.push("Long sleeves or light layer");
  } else if (feelsLike <= 25) {
    tips.push("T-shirt and comfortable pants");
  } else if (feelsLike <= 30) {
    tips.push("Light and breathable clothing");
  } else {
    tips.push("Minimal light clothing, stay cool");
  }

  // Weather condition-based
  const icon = WEATHER_CODE_MAP[weatherCode]?.icon;
  if (icon === "rain" || icon === "drizzle") {
    tips.push("Bring an umbrella & waterproof layer");
  } else if (icon === "snow") {
    tips.push("Waterproof boots & warm layers");
  } else if (icon === "sun" && feelsLike > 20) {
    tips.push("Sunglasses & sunscreen recommended");
  }

  return tips;
}

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function safeRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function SortableChecklistItem({
  item,
  isCompleted,
  isDarkMode,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ChecklistItem;
  isCompleted: boolean;
  isDarkMode: boolean;
  onToggle: (id: string) => void;
  onEdit: (item: ChecklistItem) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: "relative" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 py-2 px-2 rounded-lg transition-colors",
        isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className={cn(
          "flex-shrink-0 touch-none cursor-grab active:cursor-grabbing p-0.5 rounded",
          isDarkMode ? "text-gray-600 hover:text-gray-400" : "text-gray-300 hover:text-gray-500"
        )}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <button
        onClick={() => onToggle(item._id)}
        className="flex-shrink-0"
      >
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-purple-500" />
        ) : (
          <Circle className={cn("w-5 h-5", isDarkMode ? "text-gray-600" : "text-gray-300")} />
        )}
      </button>
      <span
        className={cn(
          "flex-1 text-sm transition-all",
          isCompleted && "line-through",
          isCompleted
            ? isDarkMode ? "text-gray-600" : "text-gray-400"
            : isDarkMode ? "text-gray-200" : "text-gray-700"
        )}
      >
        {item.title}
      </span>
      <span className={cn(
        "text-xs px-1.5 py-0.5 rounded",
        isDarkMode ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-400"
      )}>
        {item.frequency === "daily"
          ? "daily"
          : item.daysOfWeek?.map(d => DAY_LABELS[d]).join(", ")}
      </span>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onEdit(item)}
          className={cn("p-1 rounded", isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-200")}
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(item._id)}
          className={cn("p-1 rounded text-red-400", isDarkMode ? "hover:bg-red-500/20" : "hover:bg-red-50")}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  // Use dark mode as default during SSR/initial render to prevent flash
  const isDarkMode = darkMode ?? true;
  const { user } = useUser();
  const { playCompletionSound, playUncompleteSound, vibrateOnDelete } = useAudioFeedback();
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [taskOperationLoading, setTaskOperationLoading] = useState<Record<string, boolean>>({});
  const [quadrantLoading, setQuadrantLoading] = useState<Record<TaskQuadrant, boolean>>({
    "urgent-important": false,
    "important-not-urgent": false,
    "urgent-not-important": false,
    "not-urgent-not-important": false,
  });
  const [hideCompleted, setHideCompleted] = useState<Record<TaskQuadrant, boolean>>({
    "urgent-important": true,
    "important-not-urgent": true,
    "urgent-not-important": true,
    "not-urgent-not-important": true,
  });
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    quadrant: TaskQuadrant;
    priority: TaskPriority;
    dueDate: string;
    dueTime: string;
    duration: number | "";
    goalId: string;
  }>({
    title: "",
    description: "",
    quadrant: "urgent-important",
    priority: "medium",
    dueDate: "",
    dueTime: "12:00",
    duration: "",
    goalId: ""
  });
  const [quickTaskInputs, setQuickTaskInputs] = useState<Record<TaskQuadrant, string>>({
    "urgent-important": "",
    "important-not-urgent": "",
    "urgent-not-important": "",
    "not-urgent-not-important": ""
  });

  // Calendar state
  const [calendarView, setCalendarView] = useState<CalendarView>("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarDrawerOpen, setIsCalendarDrawerOpen] = useState(false);
  const [isCalendarTaskModalOpen, setIsCalendarTaskModalOpen] = useState(false);
  const [editingCalendarTask, setEditingCalendarTask] = useState<Task | null>(null);
  const [calendarTaskForm, setCalendarTaskForm] = useState({
    title: "",
    description: "",
    time: "09:00",
    duration: 30,
    quadrant: "urgent-important" as TaskQuadrant,
    priority: "medium" as TaskPriority,
    date: new Date(),
    goalId: "",
  });

  // Stats drawer state
  type StatType = "total" | "completed" | "highPriority" | "thisWeek" | null;
  const [statsDrawerType, setStatsDrawerType] = useState<StatType>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [settingsKeyInput, setSettingsKeyInput] = useState("");
  const [icalUrls, setIcalUrls] = useState<string[]>([]);
  const [settingsIcalInput, setSettingsIcalInput] = useState("");
  const [settingsIcalError, setSettingsIcalError] = useState("");

  // Calendar feed state
  interface CalendarEvent { id: string; title: string; start: string; end: string; allDay: boolean; location?: string; }
  interface CalendarGroup { name: string; events: CalendarEvent[]; error?: boolean; }
  const [calendarGroups, setCalendarGroups] = useState<CalendarGroup[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  // Flattened iCal events (with source calendar name) for the viewed Task Planning range
  type PlanningEvent = CalendarEvent & { calendar: string };
  const [planningEvents, setPlanningEvents] = useState<PlanningEvent[]>([]);
  const [planningLoading, setPlanningLoading] = useState(false);

  // Weather widget state
  const [weatherLocation, setWeatherLocation] = useState("Montreal, Quebec");
  const [weatherData, setWeatherData] = useState<{
    temp: number;
    feelsLike: number;
    weatherCode: number;
    hourly: Array<{ time: string; temp: number; weatherCode: number }>;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const locationInputRef = useRef<HTMLInputElement>(null);
  const [clothingSuggestion, setClothingSuggestion] = useState("");
  const [clothingLoading, setClothingLoading] = useState(false);
  const [plannedActivity, setPlannedActivity] = useState("");

  // Checklist state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(false);
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [showAllChecklistItems, setShowAllChecklistItems] = useState(false);
  const [checklistTab, setChecklistTab] = useState<"today" | "all" | "maintenance">("today");
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [editingMaintenanceItem, setEditingMaintenanceItem] = useState<MaintenanceItem | null>(null);
  const [maintenanceFormData, setMaintenanceFormData] = useState({ title: "", intervalDays: 90, nextDueDate: "" });
  const [paymentsData, setPaymentsData] = useState<PaymentsDueData | null>(null);
  const [paymentsError, setPaymentsError] = useState(false);
  const [expandedPaymentAccounts, setExpandedPaymentAccounts] = useState<Set<string>>(new Set());
  const [paidPaymentAccounts, setPaidPaymentAccounts] = useState<Set<string>>(new Set());
  const [editingChecklistItem, setEditingChecklistItem] = useState<ChecklistItem | null>(null);
  const [checklistFormData, setChecklistFormData] = useState({
    title: "",
    frequency: "daily" as ChecklistFrequency,
    daysOfWeek: [] as number[],
  });

  // Goals state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
  const [goalsPanelPeriodType, setGoalsPanelPeriodType] = useState<GoalPeriodType>("week");
  const [goalsPanelDate, setGoalsPanelDate] = useState(new Date());
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFormData, setGoalFormData] = useState({ title: "", note: "", parentGoalId: "" });

  // Subtask state (for edit modal)
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");

  // Helper to extract time from dueDate
  const getTimeFromDate = (dateString: string) => {
    return format(new Date(dateString), "HH:mm");
  };

  // Calendar task handlers
  const openCalendarTaskForEdit = (task: Task) => {
    setEditingCalendarTask(task);
    const taskDate = task.dueDate ? new Date(task.dueDate) : new Date();
    setCalendarTaskForm({
      title: task.title,
      description: task.description ?? "",
      time: task.dueDate ? getTimeFromDate(task.dueDate) : "09:00",
      duration: task.duration ?? 30,
      quadrant: task.quadrant,
      priority: task.priority,
      date: taskDate,
      goalId: task.goalId ?? "",
    });
    setIsCalendarTaskModalOpen(true);
  };

  const openCalendarTaskForCreate = () => {
    setEditingCalendarTask(null);
    setCalendarTaskForm({
      title: "",
      description: "",
      time: "09:00",
      duration: 30,
      quadrant: "important-not-urgent",
      priority: "medium",
      date: selectedDate,
      goalId: "",
    });
    setIsCalendarTaskModalOpen(true);
  };

  const closeCalendarTaskModal = () => {
    setIsCalendarTaskModalOpen(false);
    setEditingCalendarTask(null);
  };

  const handleSaveCalendarTask = async () => {
    if (!calendarTaskForm.title.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    // Combine date and time into full datetime (using local timezone)
    const dateObj = calendarTaskForm.date;
    const [hours, minutes] = calendarTaskForm.time.split(':');
    const fullDateTime = new Date(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate(),
      parseInt(hours ?? "9"),
      parseInt(minutes ?? "0"),
      0,
      0
    );

    try {
      if (editingCalendarTask) {
        // Update existing task
        const response = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            _id: editingCalendarTask._id,
            title: calendarTaskForm.title,
            description: calendarTaskForm.description,
            quadrant: calendarTaskForm.quadrant,
            priority: calendarTaskForm.priority,
            dueDate: fullDateTime.toISOString(),
            duration: calendarTaskForm.duration,
            goalId: calendarTaskForm.goalId || null,
          })
        });

        if (response.ok) {
          const updatedTask = await response.json() as Task;
          setTasks(prev => prev.map(task =>
            task._id === updatedTask._id ? updatedTask : task
          ));
          toast.success("Task updated successfully!");
        } else {
          toast.error("Failed to update task");
        }
      } else {
        // Create new task
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: calendarTaskForm.title,
            description: calendarTaskForm.description,
            quadrant: calendarTaskForm.quadrant,
            priority: calendarTaskForm.priority,
            dueDate: fullDateTime.toISOString(),
            duration: calendarTaskForm.duration,
            goalId: calendarTaskForm.goalId || undefined,
          })
        });

        if (response.ok) {
          const newTask = await response.json() as Task;
          setTasks(prev => [...prev, newTask]);
          toast.success("Task created successfully!");
        } else {
          toast.error("Failed to create task");
        }
      }
      closeCalendarTaskModal();
    } catch {
      toast.error("Error saving task");
    }
  };

  const handleDeleteCalendarTask = async () => {
    if (editingCalendarTask) {
      try {
        const response = await fetch(`/api/tasks?id=${editingCalendarTask._id}`, {
          method: "DELETE"
        });

        if (response.ok) {
          setTasks(prev => prev.filter(task => task._id !== editingCalendarTask._id));
          toast.success("Task deleted successfully!");
          closeCalendarTaskModal();
        } else {
          toast.error("Failed to delete task");
        }
      } catch {
        toast.error("Error deleting task");
      }
    }
  };

  const handleMoveToTomorrow = async () => {
    if (!editingCalendarTask) return;

    // Get tomorrow's date with the same time
    const currentDate = editingCalendarTask.dueDate
      ? new Date(editingCalendarTask.dueDate)
      : new Date();
    const tomorrow = addDays(currentDate, 1);

    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: editingCalendarTask._id,
          dueDate: tomorrow.toISOString(),
        })
      });

      if (response.ok) {
        const updatedTask = await response.json() as Task;
        setTasks(prev => prev.map(task =>
          task._id === updatedTask._id ? updatedTask : task
        ));
        // Update the form to reflect the new date
        setCalendarTaskForm(prev => ({
          ...prev,
          date: tomorrow
        }));
        toast.success("Task moved to tomorrow!");
      } else {
        toast.error("Failed to move task");
      }
    } catch {
      toast.error("Error moving task");
    }
  };

  // Quick-sync a scheduled task to an external calendar, straight from its card.
  const exportTaskToCalendar = (task: Task, provider: CalendarProvider) => {
    if (!task.dueDate) return;
    const startDate = new Date(task.dueDate);
    const endDate = new Date(startDate.getTime() + (task.duration ?? 30) * 60 * 1000);
    addToCalendar({ title: task.title, description: task.description, startDate, endDate }, provider);
    const messages: Record<CalendarProvider, string> = {
      google: "Opening Google Calendar",
      outlook: "Opening Outlook Calendar",
      office365: "Opening Office 365 Calendar",
      yahoo: "Opening Yahoo Calendar",
      ics: "Downloading .ics file",
    };
    toast.success(messages[provider]);
  };

  // Reschedule an overdue task to tomorrow, keeping its original time of day.
  const rescheduleTaskToTomorrow = async (task: Task) => {
    const base = task.dueDate ? new Date(task.dueDate) : new Date();
    const tomorrow = addDays(new Date(), 1);
    tomorrow.setHours(base.getHours(), base.getMinutes(), 0, 0);
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: task._id, dueDate: tomorrow.toISOString() }),
      });
      if (response.ok) {
        const updatedTask = await response.json() as Task;
        setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
        toast.success("Rescheduled to tomorrow");
      } else {
        toast.error("Failed to reschedule");
      }
    } catch {
      toast.error("Error rescheduling task");
    }
  };

  // Helper functions for calendar
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return isSameDay(taskDate, date);
    });
  };

  const getEventsForDate = (date: Date) => {
    const dayStart = startOfDay(date).getTime();
    const dayEnd = endOfDay(date).getTime();
    return planningEvents
      .filter(ev => {
        const s = new Date(ev.start).getTime();
        const e = new Date(ev.end).getTime();
        return s <= dayEnd && e >= dayStart;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  };

  const getWeekDays = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  };

  const getMonthDays = () => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const monthDays = eachDayOfInterval({ start, end });

    // Add padding days from previous month
    const startDay = start.getDay();
    const paddingStart = startDay > 0
      ? eachDayOfInterval({ start: subDays(start, startDay), end: subDays(start, 1) })
      : [];

    // Add padding days for next month to complete the grid
    const totalDays = paddingStart.length + monthDays.length;
    const paddingEnd = totalDays % 7 !== 0
      ? eachDayOfInterval({ start: addDays(end, 1), end: addDays(end, 7 - (totalDays % 7)) })
      : [];

    return [...paddingStart, ...monthDays, ...paddingEnd];
  };

  const navigateCalendar = (direction: "prev" | "next") => {
    if (calendarView === "day") {
      setSelectedDate(direction === "prev" ? subDays(selectedDate, 1) : addDays(selectedDate, 1));
    } else if (calendarView === "week") {
      setSelectedDate(direction === "prev" ? subWeeks(selectedDate, 1) : addWeeks(selectedDate, 1));
    } else {
      setSelectedDate(direction === "prev" ? subMonths(selectedDate, 1) : addMonths(selectedDate, 1));
    }
  };

  useEffect(() => {
    void fetchTasks();
    void fetchGoals();
    void fetchChecklistItems();
    void fetchMaintenanceItems();
    void fetchPaymentsDue();
    // Restore today's locally-tracked paid accounts
    try {
      const stored = localStorage.getItem(`eisenq-payments-paid-${format(new Date(), "yyyy-MM-dd")}`);
      if (stored) setPaidPaymentAccounts(new Set(JSON.parse(stored) as string[]));
    } catch { /* ignore */ }
  }, []);

  // Initialize dark mode from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem("eisenq-dark-mode");
    if (stored !== null) {
      setDarkMode(stored === "true");
    } else {
      // Use system preference
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      setDarkMode(mediaQuery.matches);

      // Listen for system preference changes
      const handler = (e: MediaQueryListEvent) => {
        // Only update if user hasn't set a preference
        if (localStorage.getItem("eisenq-dark-mode") === null) {
          setDarkMode(e.matches);
        }
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  // Initialize checklist collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("eisenq-checklist-collapsed");
    if (stored !== null) {
      setIsChecklistCollapsed(stored === "true");
    }
  }, []);

  // Initialize weather location, Gemini API key, and iCal URLs.
  // localStorage is a fast cache; the encrypted DB (via /api/settings) is the source of truth.
  useEffect(() => {
    const stored = safeGetItem("eisenq-weather-location");
    if (stored) setWeatherLocation(stored);
    const storedKey = safeGetItem("eisenq-gemini-api-key");
    if (storedKey) setGeminiApiKey(storedKey);
    const storedUrls = safeGetItem("eisenq-ical-urls");
    if (storedUrls) {
      try { setIcalUrls(JSON.parse(storedUrls) as string[]); } catch { /* ignore */ }
    }

    // Hydrate from the server and refresh the cache.
    void (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const data = (await res.json()) as { geminiApiKey?: string; icalUrls?: string[] };
        if (typeof data.geminiApiKey === "string") {
          setGeminiApiKey(data.geminiApiKey);
          if (data.geminiApiKey) safeSetItem("eisenq-gemini-api-key", data.geminiApiKey);
          else safeRemoveItem("eisenq-gemini-api-key");
        }
        if (Array.isArray(data.icalUrls)) {
          setIcalUrls(data.icalUrls);
          safeSetItem("eisenq-ical-urls", JSON.stringify(data.icalUrls));
        }
      } catch { /* offline — keep cached values */ }
    })();
  }, []);

  // Persist settings to the encrypted DB. localStorage cache is updated by callers
  // for instant reads; this fire-and-forget call keeps the server in sync.
  const persistSettings = useCallback((partial: { geminiApiKey?: string; icalUrls?: string[] }) => {
    void fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    }).catch(() => { /* ignore — cache still holds the value */ });
  }, []);

  // Lock body scroll when any modal/drawer is open
  useEffect(() => {
    const isAnyModalOpen = isModalOpen || isInfoModalOpen || isCalendarDrawerOpen || isCalendarTaskModalOpen || statsDrawerType !== null;

    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, isInfoModalOpen, isCalendarDrawerOpen, isCalendarTaskModalOpen, statsDrawerType]);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/tasks");
      if (response.ok) {
        const data = await response.json() as Task[];
        setTasks(data);
      } else {
        toast.error("Failed to fetch tasks");
      }
    } catch {
      toast.error("Error loading tasks");
    } finally {
      setIsLoading(false);
    }
  };

  // Weather functions
  const lastWeatherHashRef = useRef("");
  const clothingCacheRef = useRef<Map<string, string>>(new Map());
  const WEATHER_CACHE_MS = 30 * 60 * 1000; // 30 minutes
  const WEATHER_CACHE_KEY = "eisenq-weather-cache";

  const getWeatherCache = () => {
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as { city: string; data: NonNullable<typeof weatherData>; fetchedAt: number };
    } catch { return null; }
  };

  const setWeatherCache = (city: string, data: NonNullable<typeof weatherData>) => {
    safeSetItem(WEATHER_CACHE_KEY, JSON.stringify({ city, data, fetchedAt: Date.now() }));
  };

  const fetchWeather = useCallback(async (city: string, signal?: AbortSignal, forceRefresh = false) => {
    // Check localStorage cache: same city + within 30 min → skip fetch
    if (!forceRefresh) {
      const cache = getWeatherCache();
      if (cache && cache.city === city && Date.now() - cache.fetchedAt < WEATHER_CACHE_MS) {
        setWeatherData(cache.data);
        setWeatherError("");
        setWeatherLoading(false);
        return;
      }
    }

    setWeatherLoading(true);
    setWeatherError("");
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`, { signal });
      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null;
        setWeatherError(errData?.error ?? "Could not load weather");
        return;
      }
      const data = (await res.json()) as {
        temp: number;
        feelsLike: number;
        weatherCode: number;
        city: string;
        hourly: Array<{ time: string; temp: number; weatherCode: number }>;
      };
      const weatherResult = { temp: data.temp, feelsLike: data.feelsLike, weatherCode: data.weatherCode, hourly: data.hourly };
      setWeatherData(weatherResult);
      setWeatherCache(city, weatherResult);
    } catch {
      if (signal?.aborted) return;
      setWeatherError("Could not load weather");
    } finally {
      if (!signal?.aborted) setWeatherLoading(false);
    }
  }, []);

  const fetchClothingSuggestion = useCallback(async (activity?: string, signal?: AbortSignal) => {
    if (!geminiApiKey || !weatherData) return;

    // Check cache — skip API call if we already have a suggestion for this combo
    const cacheKey = `${weatherLocation}-${weatherData.temp}-${weatherData.weatherCode}-${activity ?? ""}`;
    const cached = clothingCacheRef.current.get(cacheKey);
    if (cached) {
      setClothingSuggestion(cached);
      return;
    }

    setClothingLoading(true);
    try {
      const condition = WEATHER_CODE_MAP[weatherData.weatherCode]?.label ?? "Unknown";
      const hourlyForecast = weatherData.hourly.map(h => ({
        time: h.time,
        temp: h.temp,
        condition: WEATHER_CODE_MAP[h.weatherCode]?.label ?? "Unknown",
      }));
      const res = await fetch("/api/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          temp: weatherData.temp,
          feelsLike: weatherData.feelsLike,
          condition,
          hourlyForecast,
          activity: activity ?? "",
          apiKey: geminiApiKey,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { suggestion: string };
        if (!signal?.aborted) {
          setClothingSuggestion(data.suggestion);
          clothingCacheRef.current.set(cacheKey, data.suggestion);
        }
      } else if (!signal?.aborted) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null;
        // Show error inline — rule-based fallback still renders below
        setClothingSuggestion(errData?.error ?? "AI suggestion unavailable. Try again later.");
      }
    } catch {
      // Fall back silently — rule-based suggestion will show
    } finally {
      if (!signal?.aborted) setClothingLoading(false);
    }
  }, [geminiApiKey, weatherData, weatherLocation]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchWeather(weatherLocation, controller.signal);
    return () => controller.abort();
  }, [weatherLocation, fetchWeather]);

  // Clear clothing cache when weather/location changes materially
  useEffect(() => {
    if (!weatherData) return;
    const hash = `${weatherLocation}-${weatherData.temp}-${weatherData.weatherCode}`;
    if (hash !== lastWeatherHashRef.current) {
      lastWeatherHashRef.current = hash;
      clothingCacheRef.current.clear();
      setClothingSuggestion("");
    }
  }, [weatherData, weatherLocation]);

  const handleLocationSubmit = () => {
    const trimmed = locationInput.trim();
    if (!trimmed) {
      setIsEditingLocation(false);
      return;
    }
    setWeatherLocation(trimmed);
    safeSetItem("eisenq-weather-location", trimmed);
    setIsEditingLocation(false);
  };

  const startEditingLocation = () => {
    setLocationInput(weatherLocation);
    setIsEditingLocation(true);
    setTimeout(() => locationInputRef.current?.focus(), 0);
  };

  // Calendar feed functions
  const fetchCalendarEvents = useCallback(async (urls: string[], signal?: AbortSignal) => {
    if (!urls.length) return;
    setCalendarLoading(true);
    try {
      const res = await fetch("/api/calendar/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        signal,
      });
      if (signal?.aborted) return;
      if (!res.ok) return;
      const data = (await res.json()) as { groups: CalendarGroup[] };
      if (signal?.aborted) return;
      setCalendarGroups(data.groups);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally {
      if (!signal?.aborted) setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!icalUrls.length) return;
    const controller = new AbortController();
    void fetchCalendarEvents(icalUrls, controller.signal);
    return () => controller.abort();
  }, [icalUrls, fetchCalendarEvents]);

  // Refresh calendar when tab regains focus
  useEffect(() => {
    if (!icalUrls.length) return;
    const onFocus = () => { void fetchCalendarEvents(icalUrls); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [icalUrls, fetchCalendarEvents]);

  // Fetch iCal events for an arbitrary date range (used by Task Planning)
  const fetchPlanningEvents = useCallback(async (urls: string[], rangeStart: Date, rangeEnd: Date, signal?: AbortSignal) => {
    if (!urls.length) { setPlanningEvents([]); setPlanningLoading(false); return; }
    setPlanningLoading(true);
    try {
      const res = await fetch("/api/calendar/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          rangeStart: rangeStart.toISOString(),
          rangeEnd: rangeEnd.toISOString(),
        }),
        signal,
      });
      if (signal?.aborted || !res.ok) return;
      const data = (await res.json()) as { groups: CalendarGroup[] };
      if (signal?.aborted) return;
      setPlanningEvents(data.groups.flatMap(g => g.events.map(e => ({ ...e, calendar: g.name }))));
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally {
      if (!signal?.aborted) setPlanningLoading(false);
    }
  }, []);

  // Refetch planning events whenever the drawer opens or the viewed range changes
  useEffect(() => {
    if (!isCalendarDrawerOpen || !icalUrls.length) { setPlanningEvents([]); setPlanningLoading(false); return; }
    let rangeStart: Date;
    let rangeEnd: Date;
    if (calendarView === "day") {
      rangeStart = startOfDay(selectedDate);
      rangeEnd = endOfDay(selectedDate);
    } else if (calendarView === "week") {
      rangeStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
      rangeEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
    } else {
      // Month grid includes padding days from adjacent months
      rangeStart = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 0 });
      rangeEnd = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 });
    }
    const controller = new AbortController();
    void fetchPlanningEvents(icalUrls, rangeStart, rangeEnd, controller.signal);
    return () => controller.abort();
  }, [isCalendarDrawerOpen, calendarView, selectedDate, icalUrls, fetchPlanningEvents]);

  // Checklist functions
  const fetchChecklistItems = async () => {
    try {
      const response = await fetch("/api/checklist");
      if (response.ok) {
        const data = await response.json() as ChecklistItem[];
        setChecklistItems(data);
      }
    } catch {
      // Silently fail
    }
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayDayOfWeek = new Date().getDay();

  const isChecklistItemVisibleToday = (item: ChecklistItem) => {
    if (item.frequency === "daily") return true;
    return item.daysOfWeek?.includes(todayDayOfWeek) ?? false;
  };

  const isChecklistItemCompletedToday = (item: ChecklistItem) => {
    return item.completedDates.includes(todayStr);
  };

  const todaysChecklistItems = checklistItems.filter(isChecklistItemVisibleToday);
  const completedCount = todaysChecklistItems.filter(isChecklistItemCompletedToday).length;

  // Today's app tasks (with a due date) shown alongside calendar events in the side panel
  const todaysScheduledTasks = tasks
    .filter(t => t.dueDate && isSameDay(new Date(t.dueDate), new Date()))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  const hasSidePanel = icalUrls.length > 0 || todaysScheduledTasks.length > 0;

  const handleToggleChecklistItem = async (id: string) => {
    // Optimistic update
    setChecklistItems(prev =>
      prev.map(item => {
        if (item._id !== id) return item;
        const isCompleted = item.completedDates.includes(todayStr);
        return {
          ...item,
          completedDates: isCompleted
            ? item.completedDates.filter(d => d !== todayStr)
            : [...item.completedDates, todayStr],
        };
      })
    );

    const item = checklistItems.find(i => i._id === id);
    if (item) {
      const wasCompleted = item.completedDates.includes(todayStr);
      if (wasCompleted) {
        playUncompleteSound();
      } else {
        playCompletionSound();
      }
    }

    try {
      await fetch("/api/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: id, date: todayStr }),
      });
    } catch {
      // Revert on failure
      void fetchChecklistItems();
    }
  };

  const resetChecklistForm = () => {
    setChecklistFormData({ title: "", frequency: "daily", daysOfWeek: [] });
    setEditingChecklistItem(null);
    setShowChecklistForm(false);
  };

  const handleAddChecklistItem = async () => {
    if (!checklistFormData.title.trim()) return;
    setChecklistLoading(true);
    try {
      const response = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: checklistFormData.title.trim(),
          frequency: checklistFormData.frequency,
          daysOfWeek: checklistFormData.frequency === "weekly" ? checklistFormData.daysOfWeek : undefined,
        }),
      });
      if (response.ok) {
        const newItem = await response.json() as ChecklistItem;
        setChecklistItems(prev => [...prev, newItem]);
        resetChecklistForm();
        toast.success("Routine item added");
      }
    } catch {
      toast.error("Failed to add routine item");
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleUpdateChecklistItem = async () => {
    if (!editingChecklistItem || !checklistFormData.title.trim()) return;
    setChecklistLoading(true);
    try {
      const response = await fetch("/api/checklist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: editingChecklistItem._id,
          title: checklistFormData.title.trim(),
          frequency: checklistFormData.frequency,
          daysOfWeek: checklistFormData.frequency === "weekly" ? checklistFormData.daysOfWeek : null,
        }),
      });
      if (response.ok) {
        const updated = await response.json() as ChecklistItem;
        setChecklistItems(prev => prev.map(i => i._id === updated._id ? updated : i));
        resetChecklistForm();
        toast.success("Routine item updated");
      }
    } catch {
      toast.error("Failed to update routine item");
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleDeleteChecklistItem = async (id: string) => {
    setChecklistItems(prev => prev.filter(i => i._id !== id));
    try {
      const response = await fetch(`/api/checklist?id=${id}`, { method: "DELETE" });
      if (!response.ok) {
        void fetchChecklistItems();
        toast.error("Failed to delete routine item");
      }
    } catch {
      void fetchChecklistItems();
      toast.error("Failed to delete routine item");
    }
  };

  const openChecklistItemForEdit = (item: ChecklistItem) => {
    setEditingChecklistItem(item);
    setChecklistFormData({
      title: item.title,
      frequency: item.frequency,
      daysOfWeek: item.daysOfWeek ?? [],
    });
    setShowChecklistForm(true);
  };

  const toggleChecklistCollapsed = () => {
    const newValue = !isChecklistCollapsed;
    setIsChecklistCollapsed(newValue);
    localStorage.setItem("eisenq-checklist-collapsed", String(newValue));
  };

  // Maintenance item functions
  const fetchMaintenanceItems = async () => {
    try {
      const res = await fetch("/api/maintenance");
      if (res.ok) setMaintenanceItems(await res.json() as MaintenanceItem[]);
    } catch { /* silently fail */ }
  };

  const handleAddMaintenanceItem = async () => {
    if (!maintenanceFormData.title.trim()) return;
    const nextDue = maintenanceFormData.nextDueDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() + maintenanceFormData.intervalDays);
      return d.toISOString().slice(0, 10);
    })();
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: maintenanceFormData.title.trim(), intervalDays: maintenanceFormData.intervalDays, nextDueDate: nextDue }),
      });
      if (res.ok) {
        await fetchMaintenanceItems();
        setMaintenanceFormData({ title: "", intervalDays: 90, nextDueDate: "" });
        setShowMaintenanceForm(false);
      }
    } catch { /* silently fail */ }
  };

  const handleUpdateMaintenanceItem = async () => {
    if (!editingMaintenanceItem || !maintenanceFormData.title.trim()) return;
    try {
      const res = await fetch("/api/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: editingMaintenanceItem._id,
          title: maintenanceFormData.title.trim(),
          intervalDays: maintenanceFormData.intervalDays,
          ...(maintenanceFormData.nextDueDate ? { nextDueDate: maintenanceFormData.nextDueDate } : {}),
        }),
      });
      if (res.ok) {
        await fetchMaintenanceItems();
        setMaintenanceFormData({ title: "", intervalDays: 90, nextDueDate: "" });
        setEditingMaintenanceItem(null);
        setShowMaintenanceForm(false);
      }
    } catch { /* silently fail */ }
  };

  const handleDeleteMaintenanceItem = async (id: string) => {
    setMaintenanceItems(prev => prev.filter(i => i._id !== id));
    try {
      const res = await fetch(`/api/maintenance?id=${id}`, { method: "DELETE" });
      if (!res.ok) void fetchMaintenanceItems();
    } catch { void fetchMaintenanceItems(); }
  };

  const handleMarkMaintenanceDone = async (id: string) => {
    try {
      const res = await fetch("/api/maintenance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: id }),
      });
      if (res.ok) await fetchMaintenanceItems();
    } catch { /* silently fail */ }
  };

  const resetMaintenanceForm = () => {
    setMaintenanceFormData({ title: "", intervalDays: 90, nextDueDate: "" });
    setEditingMaintenanceItem(null);
    setShowMaintenanceForm(false);
  };

  // Goals functions
  const weekKeyOf = (d: Date) => format(startOfWeek(d, { weekStartsOn: 0 }), "yyyy-MM-dd");
  const monthKeyOf = (d: Date) => format(d, "yyyy-MM");
  const currentWeekKey = weekKeyOf(new Date());
  const currentMonthKey = monthKeyOf(new Date());
  const goalsPanelKey = goalsPanelPeriodType === "week" ? weekKeyOf(goalsPanelDate) : monthKeyOf(goalsPanelDate);
  const goalsPanelCurrentKey = goalsPanelPeriodType === "week" ? currentWeekKey : currentMonthKey;
  const isViewingPastPeriod = goalsPanelKey < goalsPanelCurrentKey;
  const isViewingCurrentPeriod = goalsPanelKey === goalsPanelCurrentKey;

  const currentWeekGoals = goals.filter(g => g.periodType === "week" && g.periodKey === currentWeekKey);
  const currentMonthGoals = goals.filter(g => g.periodType === "month" && g.periodKey === currentMonthKey);
  const goalsPanelGoals = goals.filter(g => g.periodType === goalsPanelPeriodType && g.periodKey === goalsPanelKey);

  const goalsById = useMemo(() => new Map(goals.map(g => [g._id, g])), [goals]);

  const goalTaskCounts = useMemo(() => {
    const counts = new Map<string, { done: number; total: number }>();
    for (const task of tasks) {
      if (!task.goalId) continue;
      const entry = counts.get(task.goalId) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (task.status === "completed") entry.done += 1;
      counts.set(task.goalId, entry);
    }
    return counts;
  }, [tasks]);

  // Active month goals selectable as parent for the week being viewed in the panel
  const parentGoalOptions = (() => {
    if (goalsPanelPeriodType !== "week") return [];
    const monthKey = goalsPanelKey.slice(0, 7);
    const options = goals.filter(g => g.periodType === "month" && g.periodKey === monthKey && g.status === "active");
    // Keep the currently-linked parent selectable when editing, even if achieved/dropped/other month
    if (editingGoal?.parentGoalId && !options.some(g => g._id === editingGoal.parentGoalId)) {
      const linked = goalsById.get(editingGoal.parentGoalId);
      if (linked) return [linked, ...options];
    }
    return options;
  })();

  const fetchGoals = async () => {
    try {
      const response = await fetch("/api/goals");
      if (response.ok) {
        const data = await response.json() as Goal[];
        setGoals(data);
      }
    } catch {
      // Silently fail
    }
  };

  const resetGoalForm = () => {
    setGoalFormData({ title: "", note: "", parentGoalId: "" });
    setEditingGoal(null);
    setShowGoalForm(false);
  };

  const handleAddGoal = async () => {
    if (!goalFormData.title.trim()) return;
    setGoalsLoading(true);
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: goalFormData.title.trim(),
          note: goalFormData.note.trim() || undefined,
          periodType: goalsPanelPeriodType,
          periodKey: goalsPanelKey,
          parentGoalId: goalsPanelPeriodType === "week" ? (goalFormData.parentGoalId || undefined) : undefined,
        }),
      });
      if (response.ok) {
        const newGoal = await response.json() as Goal;
        setGoals(prev => [...prev, newGoal]);
        resetGoalForm();
        toast.success("Goal added");
      } else {
        toast.error("Failed to add goal");
      }
    } catch {
      toast.error("Failed to add goal");
    } finally {
      setGoalsLoading(false);
    }
  };

  const handleUpdateGoal = async () => {
    if (!editingGoal || !goalFormData.title.trim()) return;
    setGoalsLoading(true);
    try {
      const response = await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: editingGoal._id,
          title: goalFormData.title.trim(),
          note: goalFormData.note.trim() || null,
          ...(editingGoal.periodType === "week"
            ? { parentGoalId: goalFormData.parentGoalId || null }
            : {}),
        }),
      });
      if (response.ok) {
        const updated = await response.json() as Goal;
        setGoals(prev => prev.map(g => g._id === updated._id ? updated : g));
        resetGoalForm();
        toast.success("Goal updated");
      } else {
        toast.error("Failed to update goal");
      }
    } catch {
      toast.error("Failed to update goal");
    } finally {
      setGoalsLoading(false);
    }
  };

  const handleSetGoalStatus = async (goal: Goal, status: GoalStatus) => {
    // Optimistic update
    setGoals(prev => prev.map(g => g._id === goal._id ? { ...g, status } : g));
    if (status === "achieved") {
      playCompletionSound();
    } else if (goal.status === "achieved") {
      playUncompleteSound();
    }
    try {
      const response = await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: goal._id, status }),
      });
      if (!response.ok) void fetchGoals();
    } catch {
      void fetchGoals();
    }
  };

  const handleToggleGoalAchieved = (goal: Goal) => {
    void handleSetGoalStatus(goal, goal.status === "achieved" ? "active" : "achieved");
  };

  const handleDeleteGoal = async (id: string) => {
    // Optimistic: mirror the server-side cascade locally
    setGoals(prev => prev
      .filter(g => g._id !== id)
      .map(g => g.parentGoalId === id ? { ...g, parentGoalId: undefined } : g)
    );
    setTasks(prev => prev.map(t => t.goalId === id ? { ...t, goalId: undefined } : t));
    if (editingGoal?._id === id) resetGoalForm();
    try {
      const response = await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
      if (!response.ok) {
        void fetchGoals();
        void fetchTasks();
        toast.error("Failed to delete goal");
      }
    } catch {
      void fetchGoals();
      void fetchTasks();
      toast.error("Failed to delete goal");
    }
  };

  const handleCopyGoalToCurrentPeriod = async (goal: Goal) => {
    const targetKey = goal.periodType === "week" ? currentWeekKey : currentMonthKey;
    // Keep the monthly link only if the parent goal belongs to the current month
    const parent = goal.parentGoalId ? goalsById.get(goal.parentGoalId) : undefined;
    const keepParent = parent && parent.periodKey === currentMonthKey;
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: goal.title,
          note: goal.note,
          periodType: goal.periodType,
          periodKey: targetKey,
          parentGoalId: keepParent ? goal.parentGoalId : undefined,
        }),
      });
      if (response.ok) {
        const newGoal = await response.json() as Goal;
        setGoals(prev => [...prev, newGoal]);
        toast.success(goal.periodType === "week" ? "Copied to this week" : "Copied to this month");
      } else {
        toast.error("Failed to copy goal");
      }
    } catch {
      toast.error("Failed to copy goal");
    }
  };

  const openGoalForEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalFormData({
      title: goal.title,
      note: goal.note ?? "",
      parentGoalId: goal.parentGoalId ?? "",
    });
    setShowGoalForm(true);
  };

  const navigateGoalsPeriod = (direction: "prev" | "next") => {
    resetGoalForm();
    setGoalsPanelDate(d => {
      if (goalsPanelPeriodType === "week") {
        return direction === "prev" ? subWeeks(d, 1) : addWeeks(d, 1);
      }
      return direction === "prev" ? subMonths(d, 1) : addMonths(d, 1);
    });
  };

  const openGoalsPanelWithForm = (periodType: GoalPeriodType) => {
    setGoalsPanelPeriodType(periodType);
    setGoalsPanelDate(new Date());
    setIsGoalsExpanded(true);
    resetGoalForm();
    setShowGoalForm(true);
  };

  // Compact goal row used in the "This Week / This Month" strip
  const renderGoalStripRow = (goal: Goal) => {
    const counts = goalTaskCounts.get(goal._id);
    return (
      <div key={goal._id} className="flex items-start gap-2 py-1">
        <button
          onClick={() => handleToggleGoalAchieved(goal)}
          className={cn(
            "mt-0.5 rounded-full transition-colors",
            goal.status === "achieved"
              ? "text-emerald-500"
              : isDarkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-600"
          )}
        >
          {goal.status === "achieved" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-current" />
          )}
        </button>
        <span className={cn(
          "flex-1 text-sm",
          goal.status === "achieved" && "line-through opacity-60"
        )}>
          {goal.title}
        </span>
        {counts && (
          <span className={cn(
            "text-xs flex items-center gap-1 mt-0.5",
            counts.done === counts.total
              ? "text-emerald-500"
              : isDarkMode ? "text-gray-500" : "text-gray-400"
          )}>
            <CheckCircle2 className="w-3 h-3" />
            {counts.done}/{counts.total}
          </span>
        )}
      </div>
    );
  };

  // Label for a goal option in the task-form selects, with period context for stale goals
  const goalOptionLabel = (goal: Goal) => {
    if (goal.periodType === "week" && goal.periodKey === currentWeekKey) return goal.title;
    if (goal.periodType === "month" && goal.periodKey === currentMonthKey) return goal.title;
    if (goal.periodType === "week") {
      const [y = 0, m = 1, d = 1] = goal.periodKey.split("-").map(Number);
      return `${goal.title} (week of ${format(new Date(y, m - 1, d), "MMM d")})`;
    }
    const [y = 0, m = 1] = goal.periodKey.split("-").map(Number);
    return `${goal.title} (${format(new Date(y, m - 1, 1), "MMMM yyyy")})`;
  };

  // Options for the "Goal (optional)" select in both task forms. Active goals of the
  // current periods are always offered; a linked goal outside those (past period,
  // achieved/dropped) stays selectable so editing never silently drops the link.
  const renderGoalSelectOptions = (selectedGoalId: string) => {
    const weekOptions = currentWeekGoals.filter(g => g.status === "active");
    const monthOptions = currentMonthGoals.filter(g => g.status === "active");
    const selected = selectedGoalId ? goalsById.get(selectedGoalId) : undefined;
    const selectedIsListed = !!selected &&
      (weekOptions.some(g => g._id === selected._id) || monthOptions.some(g => g._id === selected._id));
    return (
      <>
        <option value="">No goal</option>
        {selected && !selectedIsListed && (
          <option value={selected._id}>{goalOptionLabel(selected)}</option>
        )}
        {weekOptions.length > 0 && (
          <optgroup label="This Week">
            {weekOptions.map(g => (
              <option key={g._id} value={g._id}>{g.title}</option>
            ))}
          </optgroup>
        )}
        {monthOptions.length > 0 && (
          <optgroup label="This Month">
            {monthOptions.map(g => (
              <option key={g._id} value={g._id}>{g.title}</option>
            ))}
          </optgroup>
        )}
      </>
    );
  };

  // Payments due (external finance API, grouped by account)
  const fetchPaymentsDue = async () => {
    setPaymentsError(false);
    try {
      const res = await fetch(`/api/payments?date=${format(new Date(), "yyyy-MM-dd")}`);
      if (res.ok) {
        setPaymentsData(await res.json() as PaymentsDueData);
      } else {
        setPaymentsError(true);
      }
    } catch {
      setPaymentsError(true);
    }
  };

  // Paid state is per-day and local-only until the finance API supports write-back
  const paidPaymentsStorageKey = () => `eisenq-payments-paid-${format(new Date(), "yyyy-MM-dd")}`;

  const togglePaymentAccountPaid = (accountId: string) => {
    const wasPaid = paidPaymentAccounts.has(accountId);
    if (wasPaid) {
      playUncompleteSound();
    } else {
      playCompletionSound();
    }
    const next = new Set(paidPaymentAccounts);
    if (wasPaid) {
      next.delete(accountId);
    } else {
      next.add(accountId);
    }
    setPaidPaymentAccounts(next);
    try {
      localStorage.setItem(paidPaymentsStorageKey(), JSON.stringify([...next]));
    } catch { /* ignore */ }
  };

  const togglePaymentAccountExpanded = (accountId: string) => {
    setExpandedPaymentAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const formatPaymentAmount = (amount: number) =>
    `$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Drag-to-reorder sensors and handler
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const checklistSensors = useSensors(pointerSensor, touchSensor);

  const handleChecklistDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = todaysChecklistItems.findIndex(i => i._id === active.id);
    const newIndex = todaysChecklistItems.findIndex(i => i._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedVisible = arrayMove(todaysChecklistItems, oldIndex, newIndex);

    // Map reordered visible items back into the full array, preserving invisible items in place
    let vIdx = 0;
    const reorderedFull = checklistItems.map(item =>
      isChecklistItemVisibleToday(item) ? reorderedVisible[vIdx++]! : item
    );
    const withNewOrder = reorderedFull.map((item, idx) => ({ ...item, sortOrder: idx }));

    // Optimistic update
    setChecklistItems(withNewOrder);

    // Persist only changed items
    const changed = withNewOrder
      .filter(item => {
        const orig = checklistItems.find(i => i._id === item._id);
        return orig && orig.sortOrder !== item.sortOrder;
      })
      .map(({ _id, sortOrder }) => ({ _id, sortOrder }));

    if (changed.length > 0) {
      fetch("/api/checklist/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: changed }),
      }).catch(() => {
        void fetchChecklistItems(); // revert on failure
      });
    }
  };

  const handleAddTask = async () => {
    try {
      setTaskOperationLoading(prev => ({ ...prev, addTask: true }));
      setQuadrantLoading(prev => ({ ...prev, [formData.quadrant]: true }));

      // Convert date and time to ISO datetime if provided
      let dueDateValue: string | undefined = undefined;
      if (formData.dueDate) {
        const dateParts = formData.dueDate.split('-').map(Number);
        const timeParts = formData.dueTime.split(':').map(Number);
        const year = dateParts[0] ?? 2025;
        const month = dateParts[1] ?? 1;
        const day = dateParts[2] ?? 1;
        const hours = timeParts[0] ?? 12;
        const minutes = timeParts[1] ?? 0;

        const newDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
        dueDateValue = newDate.toISOString();
      }

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          quadrant: formData.quadrant,
          priority: formData.quadrant === "urgent-important" ? "high" : formData.priority,
          dueDate: dueDateValue,
          duration: formData.duration || undefined,
          goalId: formData.goalId || undefined
        })
      });

      if (response.ok) {
        const newTask = await response.json() as Task;
        setTasks(prev => [...prev, newTask]);
        closeModal();
        toast.success("Task added successfully!");
      } else {
        toast.error("Failed to add task");
      }
    } catch {
      toast.error("Error adding task");
    } finally {
      setTaskOperationLoading(prev => ({ ...prev, addTask: false }));
      setQuadrantLoading(prev => ({ ...prev, [formData.quadrant]: false }));
    }
  };

  const handleQuickAddTask = async (quadrant: TaskQuadrant, title: string) => {
    if (!title.trim()) return;
    
    try {
      setTaskOperationLoading(prev => ({ ...prev, [`quickAdd-${quadrant}`]: true }));
      setQuadrantLoading(prev => ({ ...prev, [quadrant]: true }));
      
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          quadrant,
          priority: quadrant === "urgent-important" ? "high" : "medium",
          status: "pending"
        })
      });
      
      if (response.ok) {
        const newTask = await response.json() as Task;
        setTasks(prev => [...prev, newTask]);
        setQuickTaskInputs(prev => ({ ...prev, [quadrant]: "" }));
        toast.success("Task added!");
      } else {
        toast.error("Failed to add task");
      }
    } catch {
      toast.error("Error adding task");
    } finally {
      setTaskOperationLoading(prev => ({ ...prev, [`quickAdd-${quadrant}`]: false }));
      setQuadrantLoading(prev => ({ ...prev, [quadrant]: false }));
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;

    try {
      setTaskOperationLoading(prev => ({ ...prev, updateTask: true }));
      // Set loading for both old and new quadrants if they differ
      setQuadrantLoading(prev => ({ 
        ...prev, 
        [editingTask.quadrant]: true,
        [formData.quadrant]: true 
      }));
      
      // Convert date and time to ISO datetime if provided, or null to clear
      let dueDateValue: string | null = null;
      if (formData.dueDate) {
        // Parse the date string parts to avoid timezone issues
        const dateParts = formData.dueDate.split('-').map(Number);
        const timeParts = formData.dueTime.split(':').map(Number);
        const year = dateParts[0] ?? 2025;
        const month = dateParts[1] ?? 1;
        const day = dateParts[2] ?? 1;
        const hours = timeParts[0] ?? 12;
        const minutes = timeParts[1] ?? 0;

        // Create date in local timezone with the specified time
        const newDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
        dueDateValue = newDate.toISOString();
      }

      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: editingTask._id,
          title: formData.title,
          description: formData.description,
          quadrant: formData.quadrant,
          priority: formData.quadrant === "urgent-important" ? "high" : formData.priority,
          dueDate: dueDateValue,
          duration: formData.duration || null,
          goalId: formData.goalId || null
        })
      });

      if (response.ok) {
        const updatedTask = await response.json() as Task;
        // Preserve subtask counts - use current subtasks array as source of truth
        // since editingTask might have stale values due to closure
        setTasks(prev => {
          const existingTask = prev.find(t => t._id === updatedTask._id);
          return prev.map(task =>
            task._id === updatedTask._id
              ? {
                  ...updatedTask,
                  subtaskCount: existingTask?.subtaskCount ?? 0,
                  subtaskCompletedCount: existingTask?.subtaskCompletedCount ?? 0
                }
              : task
          );
        });
        closeModal();
        toast.success("Task updated successfully!");
      } else {
        toast.error("Failed to update task");
      }
    } catch {
      toast.error("Error updating task");
    } finally {
      setTaskOperationLoading(prev => ({ ...prev, updateTask: false }));
      setQuadrantLoading(prev => ({ 
        ...prev, 
        [editingTask.quadrant]: false,
        [formData.quadrant]: false 
      }));
    }
  };

  const handleDeleteTask = async (id: string) => {
    const taskToDelete = tasks.find(t => t._id === id);
    if (!taskToDelete) return;
    
    try {
      setTaskOperationLoading(prev => ({ ...prev, [`delete-${id}`]: true }));
      setQuadrantLoading(prev => ({ ...prev, [taskToDelete.quadrant]: true }));
      
      const response = await fetch(`/api/tasks?id=${id}`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        setTasks(prev => prev.filter(task => task._id !== id));
        vibrateOnDelete();
        toast.success("Task deleted successfully!");
      } else {
        toast.error("Failed to delete task");
      }
    } catch {
      toast.error("Error deleting task");
    } finally {
      setTaskOperationLoading(prev => ({ ...prev, [`delete-${id}`]: false }));
      setQuadrantLoading(prev => ({ ...prev, [taskToDelete.quadrant]: false }));
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      setTaskOperationLoading(prev => ({ ...prev, [`toggle-${task._id}`]: true }));
      setQuadrantLoading(prev => ({ ...prev, [task.quadrant]: true }));
      
      const newStatus = task.status === "completed" ? "pending" : "completed";
      
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: task._id,
          status: newStatus,
          completedAt: task.status === "completed" ? null : new Date()
        })
      });
      
      if (response.ok) {
        const updatedTask = await response.json() as Task;
        setTasks(prev => prev.map(t => 
          t._id === task._id ? updatedTask : t
        ));
        
        if (task.status === "completed") {
          toast.success("Task marked as pending");
          playUncompleteSound();
        } else {
          toast.success("Task completed! 🎉");
          playCompletionSound();
        }
      } else {
        toast.error("Failed to update task");
      }
    } catch {
      toast.error("Error updating task");
    } finally {
      setTaskOperationLoading(prev => ({ ...prev, [`toggle-${task._id}`]: false }));
      setQuadrantLoading(prev => ({ ...prev, [task.quadrant]: false }));
    }
  };

  // Subtask handlers
  const handleAddSubtask = async () => {
    if (!editingTask || !newSubtaskTitle.trim()) return;

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSubtaskTitle.trim(),
          parentTaskId: editingTask._id,
          quadrant: editingTask.quadrant,
          priority: "medium",
        })
      });

      if (response.ok) {
        const newSubtask = await response.json() as Task;
        setSubtasks(prev => [...prev, newSubtask]);
        setNewSubtaskTitle("");

        // Update parent task's subtask count in local state
        setTasks(prev => prev.map(t =>
          t._id === editingTask._id
            ? {
                ...t,
                subtaskCount: (t.subtaskCount ?? 0) + 1,
                subtaskCompletedCount: t.subtaskCompletedCount ?? 0
              }
            : t
        ));
        // Also update editingTask
        setEditingTask(prev => prev ? {
          ...prev,
          subtaskCount: (prev.subtaskCount ?? 0) + 1,
          subtaskCompletedCount: prev.subtaskCompletedCount ?? 0
        } : null);

        toast.success("Subtask added");
      } else {
        toast.error("Failed to add subtask");
      }
    } catch {
      toast.error("Error adding subtask");
    }
  };

  const handleToggleSubtaskComplete = async (subtask: Task) => {
    const newStatus = subtask.status === "completed" ? "pending" : "completed";

    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: subtask._id,
          status: newStatus,
        })
      });

      if (response.ok) {
        const updatedSubtask = await response.json() as Task;
        setSubtasks(prev => prev.map(s =>
          s._id === subtask._id ? updatedSubtask : s
        ));

        // Calculate new completed count
        const newCompletedCount = subtasks.filter(s =>
          s._id === subtask._id ? newStatus === "completed" : s.status === "completed"
        ).length;

        // Update parent's completed count
        setTasks(prev => prev.map(t =>
          t._id === editingTask?._id
            ? { ...t, subtaskCompletedCount: newCompletedCount }
            : t
        ));
        setEditingTask(prev => prev ? {
          ...prev,
          subtaskCompletedCount: newCompletedCount
        } : null);

        // Check if all subtasks are now complete - prompt to complete parent
        const allComplete = subtasks.every(s =>
          s._id === subtask._id ? newStatus === "completed" : s.status === "completed"
        );

        if (allComplete && editingTask?.status !== "completed" && subtasks.length > 0) {
          toast((t) => (
            <div className="flex items-center gap-3">
              <span>All subtasks complete! Complete parent task?</span>
              <button
                onClick={() => {
                  void handleCompleteParentTask();
                  toast.dismiss(t.id);
                }}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm"
              >
                Yes
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
              >
                No
              </button>
            </div>
          ), { duration: 10000 });
        }
      }
    } catch {
      toast.error("Failed to update subtask");
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      const response = await fetch(`/api/tasks?id=${subtaskId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        const deletedSubtask = subtasks.find(s => s._id === subtaskId);
        setSubtasks(prev => prev.filter(s => s._id !== subtaskId));

        // Update parent task counts
        setTasks(prev => prev.map(t =>
          t._id === editingTask?._id
            ? {
                ...t,
                subtaskCount: Math.max(0, (t.subtaskCount ?? 1) - 1),
                subtaskCompletedCount: deletedSubtask?.status === "completed"
                  ? Math.max(0, (t.subtaskCompletedCount ?? 1) - 1)
                  : t.subtaskCompletedCount
              }
            : t
        ));
        setEditingTask(prev => prev ? {
          ...prev,
          subtaskCount: Math.max(0, (prev.subtaskCount ?? 1) - 1),
          subtaskCompletedCount: deletedSubtask?.status === "completed"
            ? Math.max(0, (prev.subtaskCompletedCount ?? 1) - 1)
            : prev.subtaskCompletedCount
        } : null);

        toast.success("Subtask deleted");
      }
    } catch {
      toast.error("Failed to delete subtask");
    }
  };

  const startEditSubtask = (subtask: Task) => {
    setEditingSubtaskId(subtask._id);
    setEditingSubtaskTitle(subtask.title);
  };

  const cancelEditSubtask = () => {
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  };

  const handleUpdateSubtaskTitle = async (subtaskId: string) => {
    const trimmed = editingSubtaskTitle.trim();
    const current = subtasks.find(s => s._id === subtaskId);
    if (!trimmed || trimmed === current?.title) { cancelEditSubtask(); return; }
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: subtaskId, title: trimmed }),
      });
      if (response.ok) {
        const updatedSubtask = await response.json() as Task;
        setSubtasks(prev => prev.map(s => s._id === subtaskId ? updatedSubtask : s));
        cancelEditSubtask();
      } else {
        toast.error("Failed to update subtask");
      }
    } catch {
      toast.error("Error updating subtask");
    }
  };

  const handleCompleteParentTask = async () => {
    if (!editingTask) return;

    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: editingTask._id,
          status: "completed",
        })
      });

      if (response.ok) {
        const updatedTask = await response.json() as Task;
        setTasks(prev => prev.map(t =>
          t._id === editingTask._id ? { ...t, ...updatedTask } : t
        ));
        setEditingTask(prev => prev ? { ...prev, ...updatedTask } : null);
        toast.success("Task completed!");
      }
    } catch {
      toast.error("Failed to complete task");
    }
  };

  const handleMoveTask = async (task: Task, newQuadrant: TaskQuadrant) => {
    try {
      // Set loading for both old and new quadrants
      setQuadrantLoading(prev => ({ 
        ...prev, 
        [task.quadrant]: true,
        [newQuadrant]: true 
      }));
      
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: task._id,
          quadrant: newQuadrant
        })
      });
      
      if (response.ok) {
        const updatedTask = await response.json() as Task;
        setTasks(prev => prev.map(t => 
          t._id === task._id ? updatedTask : t
        ));
        const quadrantName = quadrantConfig[newQuadrant].title;
        toast.success(`Task moved to ${quadrantName}`);
      } else {
        toast.error("Failed to move task");
      }
    } catch {
      toast.error("Error moving task");
    } finally {
      setQuadrantLoading(prev => ({
        ...prev,
        [task.quadrant]: false,
        [newQuadrant]: false
      }));
    }
  };

  const resetFormState = () => {
    setFormData({
      title: "",
      description: "",
      quadrant: "urgent-important",
      priority: "medium",
      dueDate: "",
      dueTime: "12:00",
      duration: "",
      goalId: ""
    });
    setEditingTask(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetFormState();
    setSubtasks([]);
    setNewSubtaskTitle("");
    cancelEditSubtask();
  };

  const openModalForQuadrant = (quadrant: TaskQuadrant) => {
    setEditingTask(null);
    setFormData({
      title: "",
      description: "",
      quadrant,
      priority: quadrant === "urgent-important" ? "high" : "medium",
      dueDate: "",
      dueTime: "12:00",
      duration: "",
      goalId: ""
    });
    setIsModalOpen(true);
  };

  const openTaskForEdit = async (task: Task) => {
    setEditingTask(task);
    const taskDate = task.dueDate ? new Date(task.dueDate) : null;
    setFormData({
      title: task.title,
      description: task.description ?? "",
      quadrant: task.quadrant,
      priority: task.priority,
      dueDate: taskDate ? format(taskDate, "yyyy-MM-dd") : "",
      dueTime: taskDate ? format(taskDate, "HH:mm") : "12:00",
      duration: task.duration ?? "",
      goalId: task.goalId ?? ""
    });
    setIsModalOpen(true);

    // Fetch subtasks if this is a parent task (not a subtask itself)
    if (!task.parentTaskId && task.subtaskCount !== undefined && task.subtaskCount > 0) {
      setSubtasksLoading(true);
      try {
        const response = await fetch(`/api/tasks/${task._id}/subtasks`);
        if (response.ok) {
          const data = await response.json() as Task[];
          setSubtasks(data);
        }
      } catch {
        toast.error("Failed to load subtasks");
      } finally {
        setSubtasksLoading(false);
      }
    } else {
      setSubtasks([]);
    }
  };

  const toggleCompletedVisibility = (quadrant: TaskQuadrant) => {
    setHideCompleted(prev => ({
      ...prev,
      [quadrant]: !prev[quadrant]
    }));
  };

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTasksByQuadrant = (quadrant: TaskQuadrant) => {
    const quadrantTasks = filteredTasks.filter(task => task.quadrant === quadrant);
    
    if (hideCompleted[quadrant]) {
      return quadrantTasks.filter(task => task.status !== "completed");
    }
    
    return quadrantTasks;
  };

  // Helper to get filtered tasks for stats drawer
  const getTasksForStat = (statType: StatType): Task[] => {
    if (!statType) return [];

    switch (statType) {
      case "total":
        return tasks;
      case "completed":
        return tasks.filter(t => t.status === "completed");
      case "highPriority":
        return tasks.filter(t => (t.priority === "high" || t.quadrant === "urgent-important") && t.status !== "completed");
      case "thisWeek":
        return tasks.filter(t => {
          if (!t.dueDate) return false;
          const dueDate = new Date(t.dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDateStart = new Date(dueDate);
          dueDateStart.setHours(0, 0, 0, 0);
          const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          return dueDateStart >= today && dueDateStart <= weekFromNow;
        });
      default:
        return [];
    }
  };

  const statsDrawerConfig: Record<Exclude<StatType, null>, { title: string; icon: React.ReactNode; color: string }> = {
    total: { title: "All Tasks", icon: <TaskIcon className="w-5 h-5" />, color: "text-blue-500" },
    completed: { title: "Completed Tasks", icon: <CheckCircle2 className="w-5 h-5" />, color: "text-green-500" },
    highPriority: { title: "High Priority Tasks", icon: <AlertCircle className="w-5 h-5" />, color: "text-red-500" },
    thisWeek: { title: "Due This Week", icon: <Calendar className="w-5 h-5" />, color: "text-blue-500" },
  };

  // Multi-select helpers for stats drawer
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const selectAllTasks = (taskList: Task[]) => {
    setSelectedTaskIds(new Set(taskList.map(t => t._id)));
  };

  const clearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) return;

    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedTaskIds).map(id =>
        fetch(`/api/tasks?id=${id}`, { method: "DELETE" })
      );

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.ok).length;

      if (successCount > 0) {
        setTasks(prev => prev.filter(task => !selectedTaskIds.has(task._id)));
        toast.success(`${successCount} task${successCount !== 1 ? "s" : ""} deleted`);
        clearSelection();
      }

      if (successCount < selectedTaskIds.size) {
        toast.error(`Failed to delete ${selectedTaskIds.size - successCount} task(s)`);
      }
    } catch {
      toast.error("Error deleting tasks");
    } finally {
      setIsDeleting(false);
    }
  };

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === "completed").length,
    highPriority: tasks.filter(t => (t.priority === "high" || t.quadrant === "urgent-important") && t.status !== "completed").length,
    thisWeek: tasks.filter(t => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      const today = new Date();
      // Reset to start of day for accurate comparison
      today.setHours(0, 0, 0, 0);
      const dueDateStart = new Date(dueDate);
      dueDateStart.setHours(0, 0, 0, 0);
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      return dueDateStart >= today && dueDateStart <= weekFromNow;
    }).length
  };

  // ===== "Calm Editorial" redesign: theming + derived view models =====

  // Drive the token theme: paper background + .dark class, scoped to the dashboard.
  useEffect(() => {
    document.body.classList.add("paper");
    document.body.classList.remove("bg-gray-950", "text-white");
    return () => {
      document.body.classList.remove("paper");
      document.body.classList.add("bg-gray-950", "text-white");
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();
  const firstName = user?.firstName ?? "";

  // Per-quadrant editorial config (name, subtitle, semantic color, index, contextual copy)
  const MATRIX_META: Record<TaskQuadrant, {
    name: string; subtitle: string; color: string; index: string;
    nextLabel: string; addLabel: string; emptyTitle: string; emptySub: string;
  }> = {
    "urgent-important": {
      name: "Do First", subtitle: "Urgent & Important", color: "var(--q-do-first)", index: "01",
      nextLabel: "Next action", addLabel: "Add a task",
      emptyTitle: "Nothing urgent right now.", emptySub: "A clear, calm start to the day.",
    },
    "important-not-urgent": {
      name: "Schedule", subtitle: "Important & Not Urgent", color: "var(--q-schedule)", index: "02",
      nextLabel: "Next action", addLabel: "Add a task",
      emptyTitle: "Nothing scheduled yet.", emptySub: "Plan what matters before it turns urgent.",
    },
    "urgent-not-important": {
      name: "Delegate", subtitle: "Urgent & Not Important", color: "var(--q-delegate)", index: "03",
      nextLabel: "Next action", addLabel: "Add a task to hand off",
      emptyTitle: "Nothing to hand off.", emptySub: "You're holding only what's yours.",
    },
    "not-urgent-not-important": {
      name: "Eliminate", subtitle: "Not Urgent & Not Important", color: "var(--q-eliminate)", index: "04",
      nextLabel: "Let go of", addLabel: "Add a task to drop",
      emptyTitle: "Nothing to drop.", emptySub: "No busywork cluttering your day.",
    },
  };
  const MATRIX_ORDER: TaskQuadrant[] = [
    "urgent-important", "important-not-urgent", "urgent-not-important", "not-urgent-not-important",
  ];

  // Split a quadrant's visible tasks into the single "next action" + the "up next" list.
  // Ordering: overdue first, then earliest due date, then oldest created.
  const getQuadrantView = (quadrant: TaskQuadrant) => {
    const startToday = startOfDay(new Date());
    const sorted = [...getTasksByQuadrant(quadrant)].sort((a, b) => {
      const aOver = a.dueDate && a.status !== "completed" && new Date(a.dueDate) < startToday ? 1 : 0;
      const bOver = b.dueDate && b.status !== "completed" && new Date(b.dueDate) < startToday ? 1 : 0;
      if (aOver !== bOver) return bOver - aOver;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    // Prefer an incomplete task as the headline "next action"
    const headlineIdx = sorted.findIndex(t => t.status !== "completed");
    const idx = headlineIdx === -1 ? 0 : headlineIdx;
    const nextAction = sorted[idx];
    const upNext = sorted.filter((_, i) => i !== idx);
    return { nextAction, upNext };
  };

  const isTaskOverdue = (task: Task) =>
    !!task.dueDate && task.status !== "completed" && new Date(task.dueDate) < startOfDay(new Date());

  // This week's focus (first active weekly goal) + its task progress
  const focusGoal = currentWeekGoals.find(g => g.status === "active") ?? currentWeekGoals[0];
  const focusCounts = focusGoal ? goalTaskCounts.get(focusGoal._id) : undefined;

  // Weather summary for the masthead line
  const weatherSummary = weatherData
    ? {
        temp: Math.round(weatherData.temp),
        label: WEATHER_CODE_MAP[weatherData.weatherCode]?.label ?? "—",
        feels: Math.round(weatherData.feelsLike),
      }
    : null;

  // Payments summary for the slim due-bar
  const paymentsSummary = (() => {
    if (!paymentsData?.configured) return null;
    const accounts = paymentsData.accounts ?? [];
    const budgets = paymentsData.budgets ?? [];
    const budgetTotal = budgets.reduce((s, b) => s + b.amount, 0);
    const totalDue = Math.abs(accounts.reduce((s, a) => s + a.total, 0) + budgetTotal);
    const count = accounts.length + budgets.length;
    const income = paymentsData.totalIncome ?? 0;
    const dayEnds = paymentsData.finalBalance ?? income - totalDue;
    return { totalDue, count, income, dayEnds, hasDue: count > 0 };
  })();

  const fmtMoney = (n: number) =>
    `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen" style={{ color: "var(--ink)" }}>
      {/* ===== Masthead ===== */}
      <div className="mx-auto max-w-[1320px] px-5 md:px-10 pt-6 md:pt-8">
        {/* top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
          <div className="flex items-baseline gap-4">
            <span style={{ fontFamily: "var(--font-serif)" }} className="text-[28px] font-medium leading-none">EisenQ</span>
            <span className="text-[12px] tracking-[0.14em] uppercase" style={{ color: "var(--muted)" }}>Decide &amp; Do</span>
          </div>
          <div className="flex items-center gap-3 flex-1 md:flex-none justify-end">
            <div className="searchbar flex items-center gap-2 flex-1 md:flex-none md:w-[280px] px-4 py-[9px] rounded-[11px]"
              style={{ background: "var(--drawer)", border: "1px solid var(--field-bd)" }}>
              <Search className="w-4 h-4" style={{ color: "var(--muted)" }} />
              <input
                type="text"
                placeholder="Search tasks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-[13px] w-full"
                style={{ color: "var(--ink)" }}
              />
            </div>
            <div className="flex gap-1">
              <button className="navbtn" onClick={() => setIsCalendarDrawerOpen(true)} title="Today's calendar">
                <CalendarDays className="w-[17px] h-[17px]" />
              </button>
              <button className="navbtn" onClick={() => setIsInfoModalOpen(true)} title="About the matrix"
                style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "18px" }}>
                i
              </button>
              <button className="navbtn" onClick={() => {
                const newValue = !isDarkMode;
                setDarkMode(newValue);
                localStorage.setItem("eisenq-dark-mode", String(newValue));
              }} title="Toggle theme">
                {isDarkMode ? <Sun className="w-[17px] h-[17px]" /> : <Moon className="w-[17px] h-[17px]" />}
              </button>
              <button className="navbtn" onClick={() => { setSettingsKeyInput(geminiApiKey); setIsSettingsOpen(true); }} title="Settings">
                <Settings className="w-[17px] h-[17px]" />
              </button>
              <UserButton
                afterSignOutUrl="/sign-in"
                appearance={{ elements: { avatarBox: "w-[38px] h-[38px] rounded-[11px]" } }}
              />
            </div>
          </div>
        </div>

        {/* greeting + weather line + this week's focus */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 md:gap-10 mb-[22px] pb-[22px]"
          style={{ borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={{ fontFamily: "var(--font-serif)" }} className="text-[27px] md:text-[34px] font-normal leading-[1.1]">
              {greeting}{firstName ? `, ${firstName}` : ""}.
            </div>
            <div className="text-[14px] mt-1.5" style={{ color: "var(--muted)" }}>
              {format(new Date(), "EEEE, MMMM d")} · here&apos;s what deserves your attention today.
            </div>
            {weatherSummary && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3 text-[13px]" style={{ color: "var(--muted5)" }}>
                <span className="flex items-center gap-1.5">
                  <Cloud className="w-[15px] h-[15px]" />
                  <span style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[17px] leading-none">
                    {weatherSummary.temp}°
                  </span>
                  {weatherSummary.label} · feels {weatherSummary.feels}°
                </span>
                {clothingSuggestion && (
                  <>
                    <span className="w-[3px] h-[3px] rounded-full" style={{ background: "var(--muted6)" }} />
                    <span>
                      <span className="text-[10px] tracking-[0.1em] uppercase" style={{ color: "var(--muted2)" }}>Wear</span>
                      &nbsp;&nbsp;{clothingSuggestion}
                    </span>
                  </>
                )}
                <span className="w-[3px] h-[3px] rounded-full" style={{ background: "var(--muted6)" }} />
                <span className="flex items-center gap-1.5"><MapPin className="w-[13px] h-[13px]" />{weatherLocation}</span>
              </div>
            )}
          </div>
          {/* this week's focus */}
          <div className="md:text-right md:shrink-0 md:pt-2 md:min-w-[220px]">
            <div className="text-[10px] tracking-[0.14em] uppercase mb-[7px]" style={{ color: "var(--muted2)" }}>This week&apos;s focus</div>
            {focusGoal ? (
              <>
                <div onClick={() => setIsGoalsExpanded(true)} style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}
                  className="text-[19px] leading-[1.25] cursor-pointer">
                  {focusGoal.title}
                </div>
                {focusCounts && (
                  <div className="flex items-center gap-2 md:justify-end mt-[9px]">
                    <div className="w-[92px] h-[5px] rounded-full overflow-hidden" style={{ background: "var(--line3)" }}>
                      <div className="h-full" style={{ width: `${focusCounts.total ? (focusCounts.done / focusCounts.total) * 100 : 0}%`, background: "var(--pill-active)" }} />
                    </div>
                    <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>{focusCounts.done} / {focusCounts.total}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div onClick={() => setIsGoalsExpanded(true)} style={{ fontFamily: "var(--font-serif)", color: "var(--muted3)" }}
                  className="text-[19px] leading-[1.25] cursor-pointer">
                  No goal set yet
                </div>
                <button onClick={() => setIsGoalsExpanded(true)} className="inline-block mt-[9px] text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
                  + Add a focus ›
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Drawer */}
      <Dialog.Root open={statsDrawerType !== null} onOpenChange={(open) => {
        if (!open) {
          setStatsDrawerType(null);
          clearSelection();
        }
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            className={cn(
              "fixed right-0 top-0 h-full w-full max-w-lg z-50 shadow-xl",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
              "duration-300 ease-in-out",
              isDarkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
            )}
          >
            {statsDrawerType && (
              <div className="flex flex-col h-full">
                {/* Drawer Header */}
                <div className={cn("flex items-center justify-between p-4 border-b", isDarkMode ? "border-gray-800" : "border-gray-200")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", statsDrawerConfig[statsDrawerType].color.replace("text-", "bg-").replace("500", "600/20"))}>
                      <span className={statsDrawerConfig[statsDrawerType].color}>
                        {statsDrawerConfig[statsDrawerType].icon}
                      </span>
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold">{statsDrawerConfig[statsDrawerType].title}</Dialog.Title>
                      <Dialog.Description className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                        {selectedTaskIds.size > 0
                          ? `${selectedTaskIds.size} selected`
                          : `${getTasksForStat(statsDrawerType).length} task${getTasksForStat(statsDrawerType).length !== 1 ? "s" : ""}`
                        }
                      </Dialog.Description>
                    </div>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        isDarkMode ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-600"
                      )}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Selection Actions Bar */}
                {getTasksForStat(statsDrawerType).length > 0 && (
                  <div className={cn("flex items-center justify-between px-4 py-2 border-b", isDarkMode ? "border-gray-800" : "border-gray-200")}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const currentTasks = getTasksForStat(statsDrawerType);
                          if (selectedTaskIds.size === currentTasks.length) {
                            clearSelection();
                          } else {
                            selectAllTasks(currentTasks);
                          }
                        }}
                        className={cn(
                          "text-sm px-3 py-1.5 rounded-lg transition-colors",
                          isDarkMode ? "hover:bg-gray-800 text-gray-300" : "hover:bg-gray-100 text-gray-700"
                        )}
                      >
                        {selectedTaskIds.size === getTasksForStat(statsDrawerType).length ? "Deselect All" : "Select All"}
                      </button>
                      {selectedTaskIds.size > 0 && (
                        <button
                          onClick={clearSelection}
                          className={cn(
                            "text-sm px-3 py-1.5 rounded-lg transition-colors",
                            isDarkMode ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"
                          )}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {selectedTaskIds.size > 0 && (
                      <button
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                        className={cn(
                          "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors",
                          "bg-red-500/20 text-red-400 hover:bg-red-500/30",
                          isDeleting && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete ({selectedTaskIds.size})
                      </button>
                    )}
                  </div>
                )}

                {/* Task List */}
                <div className="flex-1 overflow-y-auto p-4">
                  {getTasksForStat(statsDrawerType).length === 0 ? (
                    <div className={cn("text-center py-12", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                      <p>No tasks found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getTasksForStat(statsDrawerType).map((task) => (
                        <div
                          key={task._id}
                          className={cn(
                            "p-4 rounded-lg border-l-4 transition-colors",
                            task.quadrant === "urgent-important" && "border-l-red-500",
                            task.quadrant === "important-not-urgent" && "border-l-yellow-500",
                            task.quadrant === "urgent-not-important" && "border-l-blue-500",
                            task.quadrant === "not-urgent-not-important" && "border-l-green-500",
                            selectedTaskIds.has(task._id)
                              ? isDarkMode ? "bg-blue-900/30 ring-1 ring-blue-500/50" : "bg-blue-50 ring-1 ring-blue-300"
                              : isDarkMode ? "bg-gray-800 hover:bg-gray-750" : "bg-gray-50 hover:bg-gray-100"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskSelection(task._id);
                              }}
                              className={cn(
                                "flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors",
                                selectedTaskIds.has(task._id)
                                  ? "bg-blue-600 border-blue-600"
                                  : isDarkMode ? "border-gray-600 hover:border-gray-500" : "border-gray-300 hover:border-gray-400"
                              )}
                            >
                              {selectedTaskIds.has(task._id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </button>

                            {/* Task Content - clickable to edit */}
                            <div
                              onClick={() => {
                                setStatsDrawerType(null);
                                clearSelection();
                                void openTaskForEdit(task);
                              }}
                              className="flex-1 min-w-0 cursor-pointer"
                            >
                              <h4 className={cn(
                                "font-medium truncate",
                                task.status === "completed" && "line-through opacity-60"
                              )}>
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className={cn(
                                  "text-sm mt-1 line-clamp-2",
                                  isDarkMode ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {task.description}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded",
                                  task.quadrant === "urgent-important" && "bg-red-500/20 text-red-400",
                                  task.quadrant === "important-not-urgent" && "bg-yellow-500/20 text-yellow-400",
                                  task.quadrant === "urgent-not-important" && "bg-blue-500/20 text-blue-400",
                                  task.quadrant === "not-urgent-not-important" && "bg-green-500/20 text-green-400"
                                )}>
                                  {quadrantConfig[task.quadrant].title}
                                </span>
                                {task.status === "completed" && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                                    Completed
                                  </span>
                                )}
                                {task.dueDate && (
                                  <span className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                                    {format(new Date(task.dueDate), "MMM dd")} • {format(new Date(task.dueDate), "HH:mm")}
                                  </span>
                                )}
                              </div>
                            </div>

                            {(task.priority === "high" || task.quadrant === "urgent-important") && task.status !== "completed" && (
                              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Calendar Planning Drawer */}
      <Dialog.Root open={isCalendarDrawerOpen} onOpenChange={setIsCalendarDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            className={cn(
              "fixed right-0 top-0 h-full w-full max-w-2xl z-50 shadow-xl",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
              "duration-300 ease-in-out",
              isDarkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
            )}
          >
            <div className="flex flex-col h-full">
              {/* Drawer Header */}
              <div className={cn("flex items-center justify-between p-4 border-b", isDarkMode ? "border-gray-800" : "border-gray-200")}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-600/20">
                    <CalendarDays className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-semibold">Task Planning</Dialog.Title>
                    <Dialog.Description className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                      Schedule and organize your tasks
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      isDarkMode ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-600"
                    )}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              {/* View Tabs */}
              <div className={cn("p-4 border-b", isDarkMode ? "border-gray-800" : "border-gray-200")}>
                <div className={cn("flex rounded-lg p-1", isDarkMode ? "bg-gray-800" : "bg-gray-100")}>
                  <button
                    onClick={() => setCalendarView("day")}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
                      calendarView === "day"
                        ? "bg-blue-600 text-white"
                        : isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <Clock className="w-4 h-4" />
                    My Day
                  </button>
                  <button
                    onClick={() => setCalendarView("week")}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
                      calendarView === "week"
                        ? "bg-blue-600 text-white"
                        : isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <CalendarRange className="w-4 h-4" />
                    My Week
                  </button>
                  <button
                    onClick={() => setCalendarView("month")}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
                      calendarView === "month"
                        ? "bg-blue-600 text-white"
                        : isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    My Month
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => navigateCalendar("prev")}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      isDarkMode ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-600"
                    )}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="text-center">
                    <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
                      {calendarView === "day" && format(selectedDate, "EEEE, MMMM d, yyyy")}
                      {calendarView === "week" && `${format(startOfWeek(selectedDate), "MMM d")} - ${format(endOfWeek(selectedDate), "MMM d, yyyy")}`}
                      {calendarView === "month" && format(selectedDate, "MMMM yyyy")}
                      {planningLoading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                    </h3>
                    {isToday(selectedDate) && calendarView === "day" && (
                      <span className="text-xs text-blue-500 font-medium">Today</span>
                    )}
                  </div>
                  <button
                    onClick={() => navigateCalendar("next")}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      isDarkMode ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-600"
                    )}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* My Day View */}
                {calendarView === "day" && (() => {
                  const dayTasks = getTasksForDate(selectedDate);
                  const dayEvents = getEventsForDate(selectedDate);
                  const showEventSkeleton = planningLoading && icalUrls.length > 0;
                  return (
                  <div className="space-y-3">
                    {!showEventSkeleton && dayTasks.length === 0 && dayEvents.length === 0 ? (
                      <div className={cn("text-center py-12 rounded-lg", isDarkMode ? "bg-gray-800" : "bg-gray-50")}>
                        <CalendarDays className={cn("w-12 h-12 mx-auto mb-3", isDarkMode ? "text-gray-600" : "text-gray-400")} />
                        <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                          No tasks scheduled for this day
                        </p>
                        <p className={cn("text-xs mt-1", isDarkMode ? "text-gray-500" : "text-gray-500")}>
                          Add tasks with due dates to see them here
                        </p>
                      </div>
                    ) : (
                      <>
                      {showEventSkeleton && [1, 2, 3].map((i) => (
                        <div
                          key={`event-skeleton-${i}`}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-lg border-l-4 border-l-indigo-200",
                            isDarkMode ? "bg-gray-800" : "bg-gray-50"
                          )}
                        >
                          <div className={cn("h-7 w-16 rounded-lg animate-pulse flex-shrink-0", isDarkMode ? "bg-gray-700" : "bg-gray-200")} />
                          <div className="flex-1 space-y-2">
                            <div className={cn("h-4 w-1/2 rounded animate-pulse", isDarkMode ? "bg-gray-700" : "bg-gray-200")} />
                            <div className={cn("h-3 w-24 rounded animate-pulse", isDarkMode ? "bg-gray-700" : "bg-gray-200")} />
                          </div>
                        </div>
                      ))}
                      {!showEventSkeleton && dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-lg border-l-4 border-l-indigo-500",
                            isDarkMode ? "bg-gray-800" : "bg-gray-50"
                          )}
                        >
                          <div className={cn(
                            "flex-shrink-0 px-3 py-1 rounded-lg text-sm font-medium",
                            isDarkMode ? "bg-gray-700" : "bg-white border border-gray-200"
                          )}>
                            {ev.allDay ? "All day" : format(new Date(ev.start), "HH:mm")}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                              {ev.title}
                            </h4>
                            {ev.location && (
                              <p className={cn("text-sm mt-1", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                                {ev.location}
                              </p>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded mt-2 bg-indigo-500/20 text-indigo-400">
                              <Calendar className="w-3 h-3" />
                              {ev.calendar}
                            </span>
                          </div>
                        </div>
                      ))}
                      {dayTasks.map((task) => (
                        <div
                          key={task._id}
                          onClick={() => openCalendarTaskForEdit(task)}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-lg border-l-4 transition-colors cursor-pointer",
                            task.quadrant === "urgent-important" && "border-l-red-500",
                            task.quadrant === "important-not-urgent" && "border-l-yellow-500",
                            task.quadrant === "urgent-not-important" && "border-l-blue-500",
                            task.quadrant === "not-urgent-not-important" && "border-l-green-500",
                            isDarkMode ? "bg-gray-800 hover:bg-gray-750" : "bg-gray-50 hover:bg-gray-100"
                          )}
                        >
                          <div className={cn(
                            "flex-shrink-0 px-3 py-1 rounded-lg text-sm font-medium",
                            isDarkMode ? "bg-gray-700" : "bg-white border border-gray-200"
                          )}>
                            {task.dueDate ? format(new Date(task.dueDate), "HH:mm") : "--:--"}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{task.title}</h4>
                            <p className={cn("text-sm mt-1", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                              {task.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className={cn(
                                "text-xs px-2 py-1 rounded",
                                task.priority === "high"
                                  ? "bg-red-500/20 text-red-400"
                                  : task.priority === "medium"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-green-500/20 text-green-400"
                              )}>
                                {task.priority}
                              </span>
                              {task.duration && (
                                <span className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                                  {task.duration} min
                                </span>
                              )}
                              {task.subtaskCount !== undefined && task.subtaskCount > 0 && (
                                <span className={cn(
                                  "text-xs flex items-center gap-1",
                                  task.subtaskCompletedCount === task.subtaskCount
                                    ? "text-green-500"
                                    : isDarkMode ? "text-gray-500" : "text-gray-400"
                                )}>
                                  <CheckCircle2 className="w-3 h-3" />
                                  {task.subtaskCompletedCount}/{task.subtaskCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      </>
                    )}
                  </div>
                  );
                })()}

                {/* My Week View */}
                {calendarView === "week" && (
                  <div className="grid grid-cols-7 gap-2">
                    {/* Day headers */}
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day} className={cn("text-center text-xs font-medium py-2", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                        {day}
                      </div>
                    ))}
                    {/* Week days */}
                    {getWeekDays().map((day) => {
                      const dayTasks = getTasksForDate(day);
                      const dayEvents = getEventsForDate(day);
                      const shownEvents = dayEvents.slice(0, 2);
                      const shownTasks = dayTasks.slice(0, 3);
                      const overflow = (dayEvents.length - shownEvents.length) + (dayTasks.length - shownTasks.length);
                      return (
                        <div
                          key={day.toISOString()}
                          onClick={() => {
                            setSelectedDate(day);
                            setCalendarView("day");
                          }}
                          className={cn(
                            "min-h-[120px] p-2 rounded-lg cursor-pointer transition-colors border",
                            isToday(day) && "ring-2 ring-blue-500",
                            darkMode
                              ? "bg-gray-800 border-gray-700 hover:bg-gray-750"
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                          )}
                        >
                          <div className={cn(
                            "text-sm font-medium mb-2",
                            isToday(day) ? "text-blue-500" : isDarkMode ? "text-gray-300" : "text-gray-700"
                          )}>
                            {format(day, "d")}
                          </div>
                          <div className="space-y-1">
                            {shownEvents.map((ev) => (
                              <div
                                key={ev.id}
                                data-tooltip={`${ev.allDay ? "All day" : format(new Date(ev.start), "HH:mm")} - ${ev.title} (${ev.calendar})`}
                                className="tooltip-task text-xs p-1.5 rounded truncate bg-indigo-500/20 text-indigo-400"
                              >
                                {ev.allDay ? "" : format(new Date(ev.start), "HH:mm") + " "}{ev.title}
                              </div>
                            ))}
                            {shownTasks.map((task) => (
                              <div
                                key={task._id}
                                data-tooltip={`${task.dueDate ? format(new Date(task.dueDate), "HH:mm") + " - " : ""}${task.title}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCalendarTaskForEdit(task);
                                }}
                                className={cn(
                                  "tooltip-task text-xs p-1.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity",
                                  task.quadrant === "urgent-important" && "bg-red-500/20 text-red-400",
                                  task.quadrant === "important-not-urgent" && "bg-yellow-500/20 text-yellow-400",
                                  task.quadrant === "urgent-not-important" && "bg-blue-500/20 text-blue-400",
                                  task.quadrant === "not-urgent-not-important" && "bg-green-500/20 text-green-400"
                                )}
                              >
                                {task.dueDate ? format(new Date(task.dueDate), "HH:mm") : ""} {task.title}
                              </div>
                            ))}
                            {overflow > 0 && (
                              <div className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                                +{overflow} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* My Month View */}
                {calendarView === "month" && (
                  <div>
                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className={cn("text-center text-xs font-medium py-2", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                          {day}
                        </div>
                      ))}
                    </div>
                    {/* Month days */}
                    <div className="grid grid-cols-7 gap-1">
                      {getMonthDays().map((day, index) => {
                        const dayTasks = getTasksForDate(day);
                        const dayEvents = getEventsForDate(day);
                        const isCurrentMonth = isSameMonth(day, selectedDate);
                        return (
                          <div
                            key={index}
                            onClick={() => {
                              setSelectedDate(day);
                              setCalendarView("day");
                            }}
                            className={cn(
                              "min-h-[80px] p-1.5 rounded-lg cursor-pointer transition-colors border",
                              isToday(day) && "ring-2 ring-blue-500",
                              !isCurrentMonth && "opacity-40",
                              darkMode
                                ? "bg-gray-800 border-gray-700 hover:bg-gray-750"
                                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                            )}
                          >
                            <div className={cn(
                              "text-xs font-medium mb-1",
                              isToday(day) ? "text-blue-500" : isDarkMode ? "text-gray-300" : "text-gray-700"
                            )}>
                              {format(day, "d")}
                            </div>
                            <div className="space-y-0.5">
                              {dayEvents.slice(0, 1).map((ev) => (
                                <div
                                  key={ev.id}
                                  data-tooltip={`${ev.allDay ? "All day" : format(new Date(ev.start), "HH:mm")} - ${ev.title} (${ev.calendar})`}
                                  className="tooltip-task text-xs p-1 rounded truncate bg-indigo-500/20 text-indigo-400"
                                >
                                  {ev.title}
                                </div>
                              ))}
                              {dayTasks.slice(0, 2).map((task) => (
                                <div
                                  key={task._id}
                                  data-tooltip={`${task.dueDate ? format(new Date(task.dueDate), "HH:mm") + " - " : ""}${task.title}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCalendarTaskForEdit(task);
                                  }}
                                  className={cn(
                                    "tooltip-task text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity",
                                    task.quadrant === "urgent-important" && "bg-red-500/20 text-red-400",
                                    task.quadrant === "important-not-urgent" && "bg-yellow-500/20 text-yellow-400",
                                    task.quadrant === "urgent-not-important" && "bg-blue-500/20 text-blue-400",
                                    task.quadrant === "not-urgent-not-important" && "bg-green-500/20 text-green-400"
                                  )}
                                >
                                  {task.title}
                                </div>
                              ))}
                              {/* Dots indicator for additional tasks/events */}
                              {(dayTasks.length > 2 || dayEvents.length > 1) && (
                                <div className="flex gap-0.5">
                                  {dayEvents.slice(1, 4).map((ev) => (
                                    <div
                                      key={ev.id}
                                      data-tooltip={`${ev.allDay ? "All day" : format(new Date(ev.start), "HH:mm")} - ${ev.title} (${ev.calendar})`}
                                      className="tooltip-task w-1.5 h-1.5 rounded-full bg-indigo-500"
                                    />
                                  ))}
                                  {dayTasks.slice(2, 5).map((task) => (
                                    <div
                                      key={task._id}
                                      data-tooltip={`${task.dueDate ? format(new Date(task.dueDate), "HH:mm") + " - " : ""}${task.title}`}
                                      className={cn(
                                        "tooltip-task w-1.5 h-1.5 rounded-full cursor-pointer",
                                        task.quadrant === "urgent-important" && "bg-red-500",
                                        task.quadrant === "important-not-urgent" && "bg-yellow-500",
                                        task.quadrant === "urgent-not-important" && "bg-blue-500",
                                        task.quadrant === "not-urgent-not-important" && "bg-green-500"
                                      )}
                                    />
                                  ))}
                                  {dayTasks.length > 5 && (
                                    <span className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                                      +{dayTasks.length - 5}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className={cn("p-4 border-t flex gap-3", isDarkMode ? "border-gray-800" : "border-gray-200")}>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    darkMode
                      ? "bg-gray-800 hover:bg-gray-700 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                  )}
                >
                  Go to Today
                </button>
                <button
                  onClick={openCalendarTaskForCreate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Calendar Task Edit Modal */}
      <Dialog.Root open={isCalendarTaskModalOpen} onOpenChange={setIsCalendarTaskModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[100]" />
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101]",
              "w-[calc(100%-2rem)] max-w-md max-h-[85vh] overflow-y-auto rounded-lg p-4 md:p-6",
              isDarkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
            )}
          >
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <Dialog.Title className="text-lg md:text-xl font-semibold">
                  {editingCalendarTask ? "Edit Task" : "New Task"}
                </Dialog.Title>
                {editingCalendarTask && (
                  <>
                    <button
                      onClick={handleMoveToTomorrow}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                        darkMode
                          ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      )}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Tomorrow
                    </button>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                            darkMode
                              ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          )}
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          Export
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className={cn(
                            "min-w-[180px] rounded-lg p-1.5 shadow-lg z-[200]",
                            isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"
                          )}
                          sideOffset={5}
                        >
                          <DropdownMenu.Item
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none",
                              isDarkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-100 text-gray-700"
                            )}
                            onClick={() => {
                              const dateObj = calendarTaskForm.date;
                              const [hours, minutes] = calendarTaskForm.time.split(':');
                              const startDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), parseInt(hours ?? "9"), parseInt(minutes ?? "0"));
                              const endDate = new Date(startDate.getTime() + (calendarTaskForm.duration || 30) * 60 * 1000);
                              addToCalendar({ title: calendarTaskForm.title, description: calendarTaskForm.description, startDate, endDate }, 'google');
                              toast.success("Opening Google Calendar");
                            }}
                          >
                            <Calendar className="w-4 h-4 text-red-500" />
                            Google Calendar
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none",
                              isDarkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-100 text-gray-700"
                            )}
                            onClick={() => {
                              const dateObj = calendarTaskForm.date;
                              const [hours, minutes] = calendarTaskForm.time.split(':');
                              const startDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), parseInt(hours ?? "9"), parseInt(minutes ?? "0"));
                              const endDate = new Date(startDate.getTime() + (calendarTaskForm.duration || 30) * 60 * 1000);
                              addToCalendar({ title: calendarTaskForm.title, description: calendarTaskForm.description, startDate, endDate }, 'outlook');
                              toast.success("Opening Outlook Calendar");
                            }}
                          >
                            <Calendar className="w-4 h-4 text-blue-500" />
                            Outlook.com
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none",
                              isDarkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-100 text-gray-700"
                            )}
                            onClick={() => {
                              const dateObj = calendarTaskForm.date;
                              const [hours, minutes] = calendarTaskForm.time.split(':');
                              const startDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), parseInt(hours ?? "9"), parseInt(minutes ?? "0"));
                              const endDate = new Date(startDate.getTime() + (calendarTaskForm.duration || 30) * 60 * 1000);
                              addToCalendar({ title: calendarTaskForm.title, description: calendarTaskForm.description, startDate, endDate }, 'office365');
                              toast.success("Opening Office 365 Calendar");
                            }}
                          >
                            <Calendar className="w-4 h-4 text-blue-600" />
                            Office 365
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none",
                              isDarkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-100 text-gray-700"
                            )}
                            onClick={() => {
                              const dateObj = calendarTaskForm.date;
                              const [hours, minutes] = calendarTaskForm.time.split(':');
                              const startDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), parseInt(hours ?? "9"), parseInt(minutes ?? "0"));
                              const endDate = new Date(startDate.getTime() + (calendarTaskForm.duration || 30) * 60 * 1000);
                              addToCalendar({ title: calendarTaskForm.title, description: calendarTaskForm.description, startDate, endDate }, 'yahoo');
                              toast.success("Opening Yahoo Calendar");
                            }}
                          >
                            <Calendar className="w-4 h-4 text-purple-500" />
                            Yahoo Calendar
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className={cn("h-px my-1", isDarkMode ? "bg-gray-700" : "bg-gray-200")} />
                          <DropdownMenu.Item
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none",
                              isDarkMode ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-100 text-gray-700"
                            )}
                            onClick={() => {
                              const dateObj = calendarTaskForm.date;
                              const [hours, minutes] = calendarTaskForm.time.split(':');
                              const startDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), parseInt(hours ?? "9"), parseInt(minutes ?? "0"));
                              const endDate = new Date(startDate.getTime() + (calendarTaskForm.duration || 30) * 60 * 1000);
                              addToCalendar({ title: calendarTaskForm.title, description: calendarTaskForm.description, startDate, endDate }, 'ics');
                              toast.success("Downloading .ics file");
                            }}
                          >
                            <Download className="w-4 h-4 text-gray-500" />
                            Download .ics
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </>
                )}
              </div>
              <Dialog.Close asChild>
                <button
                  className={cn(
                    "p-1.5 md:p-2 rounded-lg",
                    isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
                  )}
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </Dialog.Close>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className={cn("block text-sm font-medium mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Task Title
                </label>
                <input
                  type="text"
                  value={calendarTaskForm.title}
                  onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title..."
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                    darkMode
                      ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                  )}
                />
              </div>

              {/* Description */}
              <div>
                <label className={cn("block text-sm font-medium mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Description
                </label>
                <textarea
                  value={calendarTaskForm.description}
                  onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add task description..."
                  rows={2}
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                    darkMode
                      ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                  )}
                />
              </div>

              {/* Date and Time Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cn("block text-sm font-medium mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Date
                  </label>
                  <input
                    type="date"
                    min={format(new Date(), "yyyy-MM-dd")}
                    value={format(calendarTaskForm.date, "yyyy-MM-dd")}
                    onChange={(e) => {
                      // Parse date parts to avoid timezone shift issues
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      const newDate = new Date(year ?? 2025, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
                      // Ignore past dates — scheduling is forward-only
                      if (newDate < startOfDay(new Date())) return;
                      setCalendarTaskForm(prev => ({ ...prev, date: newDate }));
                    }}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      darkMode
                        ? "bg-gray-800 border-gray-700 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>
                <div>
                  <label className={cn("block text-sm font-medium mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={calendarTaskForm.time}
                    onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, time: e.target.value }))}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      darkMode
                        ? "bg-gray-800 border-gray-700 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className={cn("block text-sm font-medium mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Duration (minutes)
                </label>
                <select
                  value={calendarTaskForm.duration}
                  onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, duration: Number(e.target.value) }))}
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                    darkMode
                      ? "bg-gray-800 border-gray-700 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  )}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                </select>
              </div>

              {/* Quadrant */}
              <div>
                <label className={cn("block text-sm font-medium mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Quadrant
                </label>
                <select
                  value={calendarTaskForm.quadrant}
                  onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, quadrant: e.target.value as TaskQuadrant }))}
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                    darkMode
                      ? "bg-gray-800 border-gray-700 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  )}
                >
                  <option value="urgent-important">Urgent & Important (Do First)</option>
                  <option value="important-not-urgent">Important & Not Urgent (Schedule)</option>
                  <option value="urgent-not-important">Urgent & Not Important (Delegate)</option>
                  <option value="not-urgent-not-important">Not Urgent & Not Important (Eliminate)</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className={cn("block text-sm font-medium mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Priority
                </label>
                <select
                  value={calendarTaskForm.priority}
                  onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                    darkMode
                      ? "bg-gray-800 border-gray-700 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  )}
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              {/* Goal */}
              {(goals.length > 0 || calendarTaskForm.goalId) && (
                <div>
                  <label className={cn("block text-sm font-medium mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Goal (optional)
                  </label>
                  <select
                    value={calendarTaskForm.goalId}
                    onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, goalId: e.target.value }))}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      darkMode
                        ? "bg-gray-800 border-gray-700 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  >
                    {renderGoalSelectOptions(calendarTaskForm.goalId)}
                  </select>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              {editingCalendarTask && (
                <button
                  onClick={handleDeleteCalendarTask}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-colors",
                    "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <Dialog.Close asChild>
                <button
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                    darkMode
                      ? "bg-gray-800 hover:bg-gray-700 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                  )}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleSaveCalendarTask}
                disabled={!calendarTaskForm.title.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingCalendarTask ? "Update" : "Create"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Today + Weather row */}
      <div className="px-4 md:px-6 pb-4 md:pb-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Weather Widget */}
        <div className={cn("rounded-lg p-3 md:p-4 xl:order-2", isDarkMode ? "bg-gray-900" : "bg-white border border-gray-200")}>
          {weatherLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className={cn("w-5 h-5 animate-spin", isDarkMode ? "text-gray-400" : "text-gray-500")} />
              <span className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-500")}>Loading weather...</span>
            </div>
          ) : weatherError ? (
            <div className="space-y-2">
              <p className={cn("text-sm", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                {weatherError}
              </p>
              <div className="flex items-center gap-2">
                <MapPin className={cn("w-4 h-4 shrink-0", isDarkMode ? "text-gray-500" : "text-gray-400")} />
                <input
                  type="text"
                  defaultValue={weatherLocation}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        setWeatherLocation(val);
                        safeSetItem("eisenq-weather-location", val);
                      }
                    }
                  }}
                  className={cn(
                    "flex-1 text-sm px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                    isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                  )}
                  placeholder="Try a different city..."
                />
                <button
                  onClick={() => void fetchWeather(weatherLocation, undefined, true)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : weatherData ? (
            <div>
              {/* Location */}
              <div className="mb-2">
                {isEditingLocation ? (
                  <div className="flex items-center gap-2">
                    <MapPin className={cn("w-4 h-4 shrink-0", isDarkMode ? "text-gray-500" : "text-gray-400")} />
                    <input
                      ref={locationInputRef}
                      type="text"
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleLocationSubmit();
                        if (e.key === "Escape") setIsEditingLocation(false);
                      }}
                      onBlur={handleLocationSubmit}
                      className={cn(
                        "text-sm px-2 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 w-full",
                        isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                      placeholder="Type a city name..."
                    />
                  </div>
                ) : (
                  <button
                    onClick={startEditingLocation}
                    className={cn("flex items-center gap-1.5 text-sm hover:underline", isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700")}
                  >
                    <MapPin className="w-4 h-4" />
                    <span>{weatherLocation}</span>
                    <Edit3 className="w-3 h-3 ml-1 opacity-50" />
                  </button>
                )}
              </div>

              {/* Current weather */}
              <div className="flex items-center gap-3">
                <WeatherIcon
                  icon={WEATHER_CODE_MAP[weatherData.weatherCode]?.icon ?? "cloud"}
                  className={cn("w-8 h-8",
                    (WEATHER_CODE_MAP[weatherData.weatherCode]?.icon === "sun") ? "text-yellow-400" :
                    (WEATHER_CODE_MAP[weatherData.weatherCode]?.icon === "rain" || WEATHER_CODE_MAP[weatherData.weatherCode]?.icon === "drizzle") ? "text-blue-400" :
                    (WEATHER_CODE_MAP[weatherData.weatherCode]?.icon === "snow") ? "text-sky-300" :
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  )}
                />
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-semibold">{weatherData.temp}°C</span>
                    <span className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                      {WEATHER_CODE_MAP[weatherData.weatherCode]?.label ?? "Unknown"}
                    </span>
                  </div>
                  <span className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                    Feels like {weatherData.feelsLike}°C
                  </span>
                </div>
              </div>

              {/* Activity + Clothing suggestion */}
              <div className={cn("mt-3 pt-3 border-t", isDarkMode ? "border-gray-800" : "border-gray-200")}>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={plannedActivity}
                    onChange={(e) => setPlannedActivity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && weatherData && geminiApiKey) {
                        void fetchClothingSuggestion(plannedActivity);
                      }
                    }}
                    placeholder="Planned activity (e.g. running, cycling, hiking)..."
                    className={cn(
                      "flex-1 text-sm px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      isDarkMode ? "bg-gray-800 border-gray-700 text-white placeholder-gray-600" : "bg-white border-gray-300 placeholder-gray-400"
                    )}
                  />
                  <button
                    onClick={() => {
                      if (weatherData && geminiApiKey) {
                        void fetchClothingSuggestion(plannedActivity);
                      }
                    }}
                    disabled={clothingLoading || !geminiApiKey}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
                      "bg-blue-600 text-white hover:bg-blue-700"
                    )}
                  >
                    {clothingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ask AI"}
                  </button>
                </div>
                <div className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                  <span className={cn("font-medium", isDarkMode ? "text-gray-300" : "text-gray-600")}>What to wear: </span>
                  {clothingLoading ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Thinking...
                    </span>
                  ) : clothingSuggestion ? (
                    <span>{clothingSuggestion}</span>
                  ) : (
                    <span>
                      {getClothingSuggestion(weatherData.feelsLike, weatherData.weatherCode).join(". ")}
                      {!geminiApiKey && (
                        <>
                          {" — "}
                          <button
                            onClick={() => { setSettingsKeyInput(""); setIsSettingsOpen(true); }}
                            className="text-blue-500 hover:underline"
                          >
                            Enable AI suggestions
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Hourly forecast */}
              {weatherData.hourly.length > 0 && (
                <div className={cn("mt-3 pt-3 border-t", isDarkMode ? "border-gray-800" : "border-gray-200")}>
                  <p className={cn("text-xs font-medium mb-2", isDarkMode ? "text-gray-500" : "text-gray-400")}>Rest of today</p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {weatherData.hourly.map((h) => (
                      <div key={h.time} className="flex flex-col items-center gap-1 min-w-[3rem]">
                        <span className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>{h.time}</span>
                        <WeatherIcon
                          icon={WEATHER_CODE_MAP[h.weatherCode]?.icon ?? "cloud"}
                          className={cn("w-4 h-4",
                            (WEATHER_CODE_MAP[h.weatherCode]?.icon === "sun") ? "text-yellow-400" :
                            (WEATHER_CODE_MAP[h.weatherCode]?.icon === "rain" || WEATHER_CODE_MAP[h.weatherCode]?.icon === "drizzle") ? "text-blue-400" :
                            (WEATHER_CODE_MAP[h.weatherCode]?.icon === "snow") ? "text-sky-300" :
                            isDarkMode ? "text-gray-400" : "text-gray-500"
                          )}
                        />
                        <span className={cn("text-xs font-medium")}>{h.temp}°</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Today — Routine + Calendar (unified card) */}
        <div className={cn("xl:order-1 xl:col-span-2 rounded-lg", isDarkMode ? "bg-gray-900" : "bg-white border border-gray-200")}>

          {/* Shared header */}
          <button
            onClick={toggleChecklistCollapsed}
            className={cn(
              "w-full flex items-center justify-between p-3 md:p-4 rounded-t-lg",
              isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1">
                <div className="p-1.5 rounded-lg bg-purple-600/20">
                  <CheckCircle2 className="w-4 h-4 text-purple-500" />
                </div>
                {hasSidePanel && (
                  <div className="p-1.5 rounded-lg bg-blue-600/20">
                    <Calendar className="w-4 h-4 text-blue-500" />
                  </div>
                )}
              </div>
              <h2 className="font-semibold text-sm md:text-base">Today</h2>
              {calendarLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            </div>
            <div className="flex items-center gap-3">
              {todaysChecklistItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-medium", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                    {completedCount}/{todaysChecklistItems.length}
                  </span>
                  <div className={cn("w-16 h-1.5 rounded-full overflow-hidden", isDarkMode ? "bg-gray-700" : "bg-gray-200")}>
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${todaysChecklistItems.length > 0 ? (completedCount / todaysChecklistItems.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              {isChecklistCollapsed ? (
                <ChevronDown className={cn("w-4 h-4", isDarkMode ? "text-gray-500" : "text-gray-400")} />
              ) : (
                <ChevronUp className={cn("w-4 h-4", isDarkMode ? "text-gray-500" : "text-gray-400")} />
              )}
            </div>
          </button>

          {/* Body: two columns when calendar is active */}
          {!isChecklistCollapsed && (
            <div className={cn(
              "flex flex-col lg:flex-row",
              hasSidePanel && (isDarkMode ? "divide-y lg:divide-y-0 lg:divide-x divide-gray-800" : "divide-y lg:divide-y-0 lg:divide-x divide-gray-100")
            )}>

              {/* Routine column */}
              <div className={cn("px-3 md:px-4 pb-3 md:pb-4", hasSidePanel ? "lg:w-2/3" : "w-full")}>
                {/* Tab toggle */}
                <div className="flex items-center gap-1 mt-1 mb-2">
                  <div className={cn("inline-flex rounded-lg p-0.5", isDarkMode ? "bg-gray-800" : "bg-gray-100")}>
                    {(["today", "all", "maintenance"] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => { setChecklistTab(tab); setShowAllChecklistItems(tab === "all"); }}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-md font-medium transition-colors capitalize",
                          checklistTab === tab
                            ? "bg-purple-600 text-white"
                            : isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-800"
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Routine tabs: Today / All */}
                {checklistTab !== "maintenance" && (
                  <>
                    {(() => {
                      const displayItems = showAllChecklistItems ? checklistItems : todaysChecklistItems;
                      if (displayItems.length === 0 && !showChecklistForm) {
                        return (
                          <div className={cn("text-center py-6", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                            <Circle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">{showAllChecklistItems ? "No routine items yet" : "No routine items for today"}</p>
                            <button
                              onClick={() => setShowChecklistForm(true)}
                              className="text-xs text-purple-500 hover:text-purple-400 mt-1"
                            >
                              Add your first routine
                            </button>
                          </div>
                        );
                      }
                      return (
                        <DndContext sensors={checklistSensors} collisionDetection={closestCenter} onDragEnd={handleChecklistDragEnd}>
                          <SortableContext items={displayItems.map(i => i._id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-1">
                              {displayItems.map((item) => {
                                const visibleToday = isChecklistItemVisibleToday(item);
                                return (
                                  <div key={item._id} className={cn(!visibleToday && showAllChecklistItems && "opacity-50")}>
                                    <SortableChecklistItem
                                      item={item}
                                      isCompleted={visibleToday ? isChecklistItemCompletedToday(item) : false}
                                      isDarkMode={isDarkMode}
                                      onToggle={handleToggleChecklistItem}
                                      onEdit={openChecklistItemForEdit}
                                      onDelete={handleDeleteChecklistItem}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </SortableContext>
                        </DndContext>
                      );
                    })()}

                    {/* Add/Edit Form */}
                    {showChecklistForm ? (
                      <div className={cn(
                        "mt-3 p-3 rounded-lg border space-y-3",
                        isDarkMode ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                      )}>
                        <input
                          type="text"
                          placeholder="Routine item title..."
                          value={checklistFormData.title}
                          onChange={(e) => setChecklistFormData(prev => ({ ...prev, title: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && checklistFormData.title.trim()) {
                              void (editingChecklistItem ? handleUpdateChecklistItem() : handleAddChecklistItem());
                            }
                          }}
                          autoFocus
                          className={cn(
                            "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500",
                            isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                          )}
                        />
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-500")}>Frequency:</span>
                          <div className={cn("inline-flex rounded-lg p-0.5", isDarkMode ? "bg-gray-700" : "bg-gray-200")}>
                            <button
                              onClick={() => setChecklistFormData(prev => ({ ...prev, frequency: "daily", daysOfWeek: [] }))}
                              className={cn(
                                "px-3 py-1 text-xs rounded-md font-medium transition-colors",
                                checklistFormData.frequency === "daily"
                                  ? "bg-purple-600 text-white"
                                  : isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-800"
                              )}
                            >
                              Daily
                            </button>
                            <button
                              onClick={() => setChecklistFormData(prev => ({ ...prev, frequency: "weekly" }))}
                              className={cn(
                                "px-3 py-1 text-xs rounded-md font-medium transition-colors",
                                checklistFormData.frequency === "weekly"
                                  ? "bg-purple-600 text-white"
                                  : isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-800"
                              )}
                            >
                              Weekly
                            </button>
                          </div>
                        </div>
                        {checklistFormData.frequency === "weekly" && (
                          <div className="flex items-center gap-1.5">
                            {DAY_LABELS.map((label, i) => (
                              <button
                                key={label}
                                onClick={() => {
                                  setChecklistFormData(prev => ({
                                    ...prev,
                                    daysOfWeek: prev.daysOfWeek.includes(i)
                                      ? prev.daysOfWeek.filter(d => d !== i)
                                      : [...prev.daysOfWeek, i],
                                  }));
                                }}
                                className={cn(
                                  "w-8 h-8 rounded-full text-xs font-medium transition-colors",
                                  checklistFormData.daysOfWeek.includes(i)
                                    ? "bg-purple-600 text-white"
                                    : isDarkMode ? "bg-gray-700 text-gray-400 hover:bg-gray-600" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                )}
                              >
                                {label.charAt(0)}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={resetChecklistForm}
                            className={cn(
                              "flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                              isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"
                            )}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={editingChecklistItem ? handleUpdateChecklistItem : handleAddChecklistItem}
                            disabled={!checklistFormData.title.trim() || checklistLoading || (checklistFormData.frequency === "weekly" && checklistFormData.daysOfWeek.length === 0)}
                            className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            {checklistLoading ? "Saving..." : editingChecklistItem ? "Update" : "Add"}
                          </button>
                        </div>
                      </div>
                    ) : (showAllChecklistItems ? checklistItems.length > 0 : todaysChecklistItems.length > 0) && (
                      <button
                        onClick={() => setShowChecklistForm(true)}
                        className={cn(
                          "mt-2 flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg transition-colors",
                          isDarkMode ? "text-gray-500 hover:text-gray-300 hover:bg-gray-800" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add routine item
                      </button>
                    )}

                    {/* Due maintenance items on Today tab */}
                    {checklistTab === "today" && (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dueItems = maintenanceItems.filter(item => {
                        const due = new Date(item.nextDueDate + "T00:00:00");
                        return due.getTime() <= today.getTime() + 7 * 86400000; // due within 7 days
                      });
                      if (!dueItems.length) return null;
                      return (
                        <div className={cn("mt-3 pt-3 border-t", isDarkMode ? "border-gray-800" : "border-gray-200")}>
                          <p className={cn("text-xs font-semibold uppercase tracking-wide mb-2 px-1", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                            Maintenance due
                          </p>
                          <div className="space-y-1">
                            {dueItems.map(item => {
                              const due = new Date(item.nextDueDate + "T00:00:00");
                              const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
                              const isOverdue = diffDays < 0;
                              return (
                                <div key={item._id} className={cn("flex items-center gap-3 py-1.5 px-2 rounded-lg", isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-50")}>
                                  <button
                                    onClick={() => void handleMarkMaintenanceDone(item._id)}
                                    className="flex-shrink-0"
                                    title="Mark as done — resets the timer"
                                  >
                                    <Circle className={cn("w-5 h-5", isOverdue ? "text-red-400" : "text-yellow-500")} />
                                  </button>
                                  <span className={cn("flex-1 text-sm truncate", isDarkMode ? "text-gray-200" : "text-gray-700")}>{item.title}</span>
                                  <span className={cn("text-xs flex-shrink-0", isOverdue ? "text-red-400" : "text-yellow-500")}>
                                    {isOverdue ? `${Math.abs(diffDays)}d overdue` : diffDays === 0 ? "today" : `in ${diffDays}d`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Payments failures are otherwise invisible — surface them with a retry */}
                    {checklistTab === "today" && paymentsError && (
                      <div className={cn(
                        "mt-3 pt-3 border-t flex items-center justify-between px-1",
                        isDarkMode ? "border-gray-800" : "border-gray-200"
                      )}>
                        <span className={cn("text-xs flex items-center gap-1.5", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                          <AlertCircle className="w-3.5 h-3.5" />
                          Couldn&apos;t load payments
                        </span>
                        <button
                          onClick={() => void fetchPaymentsDue()}
                          className="text-xs text-blue-500 hover:text-blue-400"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {/* Payments due on Today tab (external finance API, grouped by account) */}
                    {checklistTab === "today" && paymentsData?.configured && (() => {
                      const accounts = paymentsData.accounts ?? [];
                      const budgets = paymentsData.budgets ?? [];
                      const budgetTotal = budgets.reduce((s, b) => s + b.amount, 0);
                      const rows = [
                        ...accounts.map(a => ({ id: a.id, name: a.shortName, total: a.total, items: a.items })),
                        ...(budgets.length > 0 ? [{ id: "budgets", name: "Other payments", total: budgetTotal, items: budgets }] : []),
                      ];
                      if (!rows.length) return null;
                      const totalDue = rows.reduce((s, r) => s + r.total, 0);
                      const finalBalance = paymentsData.finalBalance ?? 0;
                      return (
                        <div className={cn("mt-3 pt-3 border-t", isDarkMode ? "border-gray-800" : "border-gray-200")}>
                          <div className="flex items-baseline justify-between mb-2 px-1">
                            <p className={cn("text-xs font-semibold uppercase tracking-wide", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                              Payments due
                            </p>
                            <span className="text-xs font-medium text-red-400">{formatPaymentAmount(totalDue)}</span>
                          </div>
                          <div className="space-y-0.5">
                            {rows.map(row => {
                              const isPaid = paidPaymentAccounts.has(row.id);
                              const isExpanded = expandedPaymentAccounts.has(row.id);
                              return (
                                <div key={row.id}>
                                  <div className={cn("flex items-center gap-3 py-1.5 px-2 rounded-lg", isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-50")}>
                                    <button
                                      onClick={() => togglePaymentAccountPaid(row.id)}
                                      className="flex-shrink-0"
                                      title={isPaid ? "Mark as unpaid" : "Mark as paid"}
                                    >
                                      {isPaid ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                      ) : (
                                        <Circle className="w-5 h-5 text-red-400" />
                                      )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <p className={cn("text-sm font-medium truncate", isPaid && "line-through opacity-60", isDarkMode ? "text-gray-200" : "text-gray-700")}>
                                        {row.name}
                                      </p>
                                      <p className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                                        {row.items.length} payment{row.items.length !== 1 ? "s" : ""}
                                      </p>
                                    </div>
                                    <span className={cn("text-sm font-medium flex-shrink-0", isPaid ? "line-through opacity-60" : "", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                                      {formatPaymentAmount(row.total)}
                                    </span>
                                    <button
                                      onClick={() => togglePaymentAccountExpanded(row.id)}
                                      className={cn(
                                        "flex-shrink-0 p-1 rounded-full transition-colors",
                                        isExpanded
                                          ? "bg-blue-600/20 text-blue-500"
                                          : isDarkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
                                      )}
                                      title={isExpanded ? "Hide details" : "Show details"}
                                    >
                                      <Info className="w-4 h-4" />
                                    </button>
                                  </div>
                                  {isExpanded && (
                                    <div className={cn("ml-10 mr-9 mb-1.5 px-3 py-1 rounded-lg", isDarkMode ? "bg-gray-800/50" : "bg-gray-50")}>
                                      {[...row.items].sort((a, b) => a.amount - b.amount).map((it, ii) => (
                                        <div
                                          key={ii}
                                          className={cn(
                                            "flex items-center justify-between gap-3 py-1 text-xs",
                                            ii > 0 && (isDarkMode ? "border-t border-gray-800" : "border-t border-gray-200")
                                          )}
                                        >
                                          <span className={cn("truncate", isDarkMode ? "text-gray-400" : "text-gray-500")}>{it.label}</span>
                                          <span className={cn("flex-shrink-0", isDarkMode ? "text-gray-300" : "text-gray-600")}>{formatPaymentAmount(it.amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className={cn("flex items-center justify-between mt-2 pt-2 border-t text-xs", isDarkMode ? "border-gray-800 text-gray-500" : "border-gray-200 text-gray-400")}>
                            <span>Income {formatPaymentAmount(paymentsData.totalIncome ?? 0)}</span>
                            <span>
                              Day ends{" "}
                              <span className={cn("font-medium", finalBalance >= 0 ? "text-green-500" : "text-red-400")}>
                                {finalBalance >= 0 ? "+" : "-"}{formatPaymentAmount(finalBalance)}
                              </span>
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* Maintenance tab */}
                {checklistTab === "maintenance" && (
                  <div>
                    {maintenanceItems.length === 0 && !showMaintenanceForm ? (
                      <div className={cn("text-center py-6", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                        <Repeat className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No maintenance items yet</p>
                        <button
                          onClick={() => setShowMaintenanceForm(true)}
                          className="text-xs text-purple-500 hover:text-purple-400 mt-1"
                        >
                          Add your first item
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {maintenanceItems.map((item) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const due = new Date(item.nextDueDate + "T00:00:00");
                          const diffMs = due.getTime() - today.getTime();
                          const diffDays = Math.round(diffMs / 86400000);
                          const isOverdue = diffDays < 0;
                          const isDueSoon = diffDays >= 0 && diffDays <= 7;

                          return (
                            <div
                              key={item._id}
                              className={cn(
                                "flex items-center gap-3 py-2 px-2 rounded-lg",
                                isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                              )}
                            >
                              <button
                                onClick={() => void handleMarkMaintenanceDone(item._id)}
                                className="flex-shrink-0"
                                title="Mark as done — resets the timer"
                              >
                                <Circle className={cn("w-5 h-5", isOverdue ? "text-red-400" : isDueSoon ? "text-yellow-500" : isDarkMode ? "text-gray-600" : "text-gray-300")} />
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm font-medium truncate", isDarkMode ? "text-gray-200" : "text-gray-700")}>
                                  {item.title}
                                </p>
                                <p className={cn("text-xs", isOverdue ? "text-red-400" : isDueSoon ? "text-yellow-500" : isDarkMode ? "text-gray-500" : "text-gray-400")}>
                                  {isOverdue
                                    ? `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""}`
                                    : diffDays === 0
                                      ? "Due today"
                                      : `Due in ${diffDays} day${diffDays !== 1 ? "s" : ""}`}
                                  {" · every "}
                                  {item.intervalDays >= 365
                                    ? `${Math.round(item.intervalDays / 365)} year${Math.round(item.intervalDays / 365) !== 1 ? "s" : ""}`
                                    : item.intervalDays >= 30
                                      ? `${Math.round(item.intervalDays / 30)} month${Math.round(item.intervalDays / 30) !== 1 ? "s" : ""}`
                                      : `${item.intervalDays} day${item.intervalDays !== 1 ? "s" : ""}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => {
                                    setEditingMaintenanceItem(item);
                                    setMaintenanceFormData({ title: item.title, intervalDays: item.intervalDays, nextDueDate: item.nextDueDate });
                                    setShowMaintenanceForm(true);
                                  }}
                                  className={cn("p-1 rounded", isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-200")}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => void handleDeleteMaintenanceItem(item._id)}
                                  className={cn("p-1 rounded text-red-400", isDarkMode ? "hover:bg-red-500/20" : "hover:bg-red-50")}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Maintenance Add/Edit Form */}
                    {showMaintenanceForm ? (
                      <div className={cn(
                        "mt-3 p-3 rounded-lg border space-y-3",
                        isDarkMode ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                      )}>
                        <input
                          type="text"
                          placeholder="e.g. Doctor appointment, Change toothbrush..."
                          value={maintenanceFormData.title}
                          onChange={(e) => setMaintenanceFormData(prev => ({ ...prev, title: e.target.value }))}
                          autoFocus
                          className={cn(
                            "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500",
                            isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                          )}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-500")}>Every:</span>
                          <div className={cn("inline-flex rounded-lg p-0.5 flex-wrap", isDarkMode ? "bg-gray-700" : "bg-gray-200")}>
                            {INTERVAL_PRESETS.map(p => (
                              <button
                                key={p.days}
                                onClick={() => setMaintenanceFormData(prev => ({ ...prev, intervalDays: p.days }))}
                                className={cn(
                                  "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                                  maintenanceFormData.intervalDays === p.days
                                    ? "bg-purple-600 text-white"
                                    : isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-800"
                                )}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-500")}>Next due:</span>
                          <input
                            type="date"
                            value={maintenanceFormData.nextDueDate}
                            onChange={(e) => setMaintenanceFormData(prev => ({ ...prev, nextDueDate: e.target.value }))}
                            className={cn(
                              "px-2 py-1 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-purple-500",
                              isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                            )}
                          />
                          <span className={cn("text-xs", isDarkMode ? "text-gray-600" : "text-gray-400")}>(optional)</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={resetMaintenanceForm}
                            className={cn(
                              "flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                              isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"
                            )}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void (editingMaintenanceItem ? handleUpdateMaintenanceItem() : handleAddMaintenanceItem())}
                            disabled={!maintenanceFormData.title.trim()}
                            className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            {editingMaintenanceItem ? "Update" : "Add"}
                          </button>
                        </div>
                      </div>
                    ) : maintenanceItems.length > 0 && (
                      <button
                        onClick={() => setShowMaintenanceForm(true)}
                        className={cn(
                          "mt-2 flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg transition-colors",
                          isDarkMode ? "text-gray-500 hover:text-gray-300 hover:bg-gray-800" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add maintenance item
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Calendar Events column */}
              {hasSidePanel && (
                <div className="px-3 md:px-4 pb-3 md:pb-4 pt-2 lg:w-1/3">
                  {calendarLoading && calendarGroups.length === 0 ? (
                    <div className="space-y-2 py-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className={cn("h-12 rounded-lg animate-pulse", isDarkMode ? "bg-gray-800" : "bg-gray-100")} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4 mt-1">
                      {/* Scheduled in-app tasks for today */}
                      {todaysScheduledTasks.length > 0 && (
                        <div>
                          <p className={cn("text-xs font-semibold uppercase tracking-wide mb-1.5 px-1", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                            Scheduled Tasks
                          </p>
                          <div className="space-y-1.5">
                            {todaysScheduledTasks.map((task) => (
                              <div
                                key={task._id}
                                onClick={() => openCalendarTaskForEdit(task)}
                                className={cn(
                                  "flex items-start gap-2.5 px-3 py-2.5 rounded-lg border-l-2 cursor-pointer transition-colors",
                                  task.quadrant === "urgent-important" && "border-red-500",
                                  task.quadrant === "important-not-urgent" && "border-yellow-500",
                                  task.quadrant === "urgent-not-important" && "border-blue-500",
                                  task.quadrant === "not-urgent-not-important" && "border-green-500",
                                  isDarkMode ? "bg-gray-800/60 hover:bg-gray-800" : "bg-gray-50 hover:bg-gray-100"
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm font-medium truncate", isDarkMode ? "text-gray-100" : "text-gray-800")}>
                                    {task.title}
                                  </p>
                                  <p className={cn("text-xs mt-0.5", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                                    {task.dueDate ? new Date(task.dueDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}
                                    {task.duration ? ` · ${task.duration} min` : ""}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {calendarGroups.map((group, gi) => (
                        <div key={gi}>
                          <p className={cn("text-xs font-semibold uppercase tracking-wide mb-1.5 px-1", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                            {group.name}
                          </p>
                          {group.events.length === 0 ? (
                            <p className={cn("text-xs px-1 py-2", group.error ? "text-red-400" : isDarkMode ? "text-gray-600" : "text-gray-400")}>
                              {group.error ? "Could not load — check URL in Settings" : "No events today"}
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {group.events.map((event) => {
                                const startDate = new Date(event.start);
                                const endDate = new Date(event.end);
                                const timeStr = event.allDay
                                  ? "All day"
                                  : `${startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${endDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
                                return (
                                  <div
                                    key={event.id}
                                    className={cn(
                                      "flex items-start gap-2.5 px-3 py-2.5 rounded-lg border-l-2 border-blue-500",
                                      isDarkMode ? "bg-gray-800/60" : "bg-blue-50/60"
                                    )}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className={cn("text-sm font-medium truncate", isDarkMode ? "text-gray-100" : "text-gray-800")}>
                                        {event.title}
                                      </p>
                                      <p className={cn("text-xs mt-0.5", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                                        {timeStr}
                                      </p>
                                      {event.location && (
                                        <p className={cn("text-xs truncate mt-0.5", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                                          <MapPin className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                                          {event.location}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        </div>{/* end grid */}
      </div>

      {/* Goals — weekly & monthly focus */}
      <div className="px-4 md:px-6 pb-4 md:pb-6">
        <div className={cn("rounded-lg", isDarkMode ? "bg-gray-900" : "bg-white border border-gray-200")}>

          {/* Header */}
          <button
            onClick={() => { setIsGoalsExpanded(!isGoalsExpanded); resetGoalForm(); }}
            className={cn(
              "w-full flex items-center justify-between p-3 md:p-4 rounded-t-lg",
              isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-600/20">
                <Target className="w-4 h-4 text-emerald-500" />
              </div>
              <h2 className="font-semibold text-sm md:text-base">Goals</h2>
            </div>
            <div className="flex items-center gap-3">
              {(currentWeekGoals.length > 0 || currentMonthGoals.length > 0) && (
                <span className={cn("text-xs font-medium", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                  {[...currentWeekGoals, ...currentMonthGoals].filter(g => g.status === "achieved").length}
                  /{currentWeekGoals.length + currentMonthGoals.length} achieved
                </span>
              )}
              {isGoalsExpanded ? (
                <ChevronUp className={cn("w-4 h-4", isDarkMode ? "text-gray-500" : "text-gray-400")} />
              ) : (
                <ChevronDown className={cn("w-4 h-4", isDarkMode ? "text-gray-500" : "text-gray-400")} />
              )}
            </div>
          </button>

          <div className="px-3 md:px-4 pb-3 md:pb-4">
            {!isGoalsExpanded ? (
              /* Compact strip: current week + current month */
              goals.length === 0 ? (
                <div className={cn("text-center py-6", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Set weekly or monthly goals to keep your tasks aligned with what matters</p>
                  <button
                    onClick={() => openGoalsPanelWithForm("week")}
                    className="text-xs text-emerald-500 hover:text-emerald-400 mt-1"
                  >
                    Add your first goal
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <p className={cn("text-xs font-semibold uppercase tracking-wide mb-1", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                      This Week
                    </p>
                    {currentWeekGoals.filter(g => g.status !== "dropped").length === 0 ? (
                      <button
                        onClick={() => openGoalsPanelWithForm("week")}
                        className={cn("text-xs", isDarkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")}
                      >
                        + Add a goal for this week
                      </button>
                    ) : (
                      currentWeekGoals.filter(g => g.status !== "dropped").map(renderGoalStripRow)
                    )}
                  </div>
                  <div>
                    <p className={cn("text-xs font-semibold uppercase tracking-wide mb-1", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                      This Month
                    </p>
                    {currentMonthGoals.filter(g => g.status !== "dropped").length === 0 ? (
                      <button
                        onClick={() => openGoalsPanelWithForm("month")}
                        className={cn("text-xs", isDarkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")}
                      >
                        + Add a goal for this month
                      </button>
                    ) : (
                      currentMonthGoals.filter(g => g.status !== "dropped").map(renderGoalStripRow)
                    )}
                  </div>
                </div>
              )
            ) : (
              /* Expanded management panel */
              <div className="space-y-3">
                {/* Period type toggle + navigation */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className={cn("inline-flex rounded-lg p-0.5", isDarkMode ? "bg-gray-800" : "bg-gray-100")}>
                    {(["week", "month"] as const).map(pt => (
                      <button
                        key={pt}
                        onClick={() => { setGoalsPanelPeriodType(pt); resetGoalForm(); }}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                          goalsPanelPeriodType === pt
                            ? "bg-emerald-600 text-white"
                            : isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-800"
                        )}
                      >
                        {pt === "week" ? "Weekly" : "Monthly"}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigateGoalsPeriod("prev")}
                      className={cn("p-1.5 rounded-lg", isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs md:text-sm font-medium min-w-[140px] text-center">
                      {goalsPanelPeriodType === "week"
                        ? `${format(startOfWeek(goalsPanelDate, { weekStartsOn: 0 }), "MMM d")} – ${format(endOfWeek(goalsPanelDate, { weekStartsOn: 0 }), "MMM d, yyyy")}`
                        : format(goalsPanelDate, "MMMM yyyy")}
                    </span>
                    <button
                      onClick={() => navigateGoalsPeriod("next")}
                      className={cn("p-1.5 rounded-lg", isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    {!isViewingCurrentPeriod && (
                      <button
                        onClick={() => { setGoalsPanelDate(new Date()); resetGoalForm(); }}
                        className="text-xs text-emerald-500 hover:text-emerald-400 ml-1"
                      >
                        Current
                      </button>
                    )}
                  </div>
                </div>

                {/* Goal list for the viewed period */}
                {goalsPanelGoals.length === 0 && !showGoalForm ? (
                  <div className={cn("text-center py-4 text-sm", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                    No goals for this {goalsPanelPeriodType}.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {goalsPanelGoals.map(goal => {
                      const counts = goalTaskCounts.get(goal._id);
                      const parentGoal = goal.parentGoalId ? goalsById.get(goal.parentGoalId) : undefined;
                      return (
                        <div
                          key={goal._id}
                          className={cn(
                            "group flex items-start gap-2 px-2 py-1.5 rounded-lg",
                            isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-50",
                            goal.status === "dropped" && "opacity-50"
                          )}
                        >
                          <button
                            onClick={() => handleToggleGoalAchieved(goal)}
                            className={cn(
                              "mt-0.5 rounded-full transition-colors",
                              goal.status === "achieved"
                                ? "text-emerald-500"
                                : isDarkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-600"
                            )}
                          >
                            {goal.status === "achieved" ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-current" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm",
                              (goal.status === "achieved" || goal.status === "dropped") && "line-through opacity-60"
                            )}>
                              {goal.title}
                            </p>
                            {goal.note && (
                              <p className={cn("text-xs mt-0.5", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                                {goal.note}
                              </p>
                            )}
                            {parentGoal && (
                              <p className={cn("text-xs mt-0.5 flex items-center gap-1", isDarkMode ? "text-emerald-500" : "text-emerald-600")}>
                                <Target className="w-3 h-3 shrink-0" />
                                {parentGoal.title}
                              </p>
                            )}
                          </div>
                          {counts && (
                            <span className={cn(
                              "text-xs flex items-center gap-1 mt-1",
                              counts.done === counts.total
                                ? "text-emerald-500"
                                : isDarkMode ? "text-gray-500" : "text-gray-400"
                            )}>
                              <CheckCircle2 className="w-3 h-3" />
                              {counts.done}/{counts.total}
                            </span>
                          )}
                          <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            {isViewingPastPeriod && goal.status === "active" && (
                              <button
                                onClick={() => void handleCopyGoalToCurrentPeriod(goal)}
                                title={goalsPanelPeriodType === "week" ? "Copy to this week" : "Copy to this month"}
                                className={cn("p-1 rounded text-emerald-500", isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100")}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => openGoalForEdit(goal)}
                              title="Edit goal"
                              className={cn("p-1 rounded", isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-100")}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => void handleSetGoalStatus(goal, goal.status === "dropped" ? "active" : "dropped")}
                              title={goal.status === "dropped" ? "Restore goal" : "Drop goal"}
                              className={cn("p-1 rounded", isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-100")}
                            >
                              {goal.status === "dropped" ? <Repeat className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => void handleDeleteGoal(goal._id)}
                              title="Delete goal"
                              className="p-1 rounded text-red-400 hover:bg-red-500/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add/Edit form */}
                {showGoalForm ? (
                  <div className={cn(
                    "p-3 rounded-lg border space-y-3",
                    isDarkMode ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <input
                      type="text"
                      placeholder={goalsPanelPeriodType === "week" ? "What do you want to achieve this week?" : "What do you want to achieve this month?"}
                      value={goalFormData.title}
                      onChange={(e) => setGoalFormData(prev => ({ ...prev, title: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && goalFormData.title.trim()) {
                          void (editingGoal ? handleUpdateGoal() : handleAddGoal());
                        }
                      }}
                      autoFocus
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500",
                        isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={goalFormData.note}
                      onChange={(e) => setGoalFormData(prev => ({ ...prev, note: e.target.value }))}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500",
                        isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    {goalsPanelPeriodType === "week" && parentGoalOptions.length > 0 && (
                      <div>
                        <label className={cn("block text-xs mb-1", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                          Link to monthly goal (optional)
                        </label>
                        <select
                          value={goalFormData.parentGoalId}
                          onChange={(e) => setGoalFormData(prev => ({ ...prev, parentGoalId: e.target.value }))}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500",
                            isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                          )}
                        >
                          <option value="">No monthly goal</option>
                          {parentGoalOptions.map(g => (
                            <option key={g._id} value={g._id}>{g.title}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={resetGoalForm}
                        className={cn(
                          "flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                          isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"
                        )}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={editingGoal ? handleUpdateGoal : handleAddGoal}
                        disabled={!goalFormData.title.trim() || goalsLoading}
                        className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {goalsLoading ? "Saving..." : editingGoal ? "Update" : "Add"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { resetGoalForm(); setShowGoalForm(true); }}
                    className={cn(
                      "flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg transition-colors",
                      isDarkMode ? "text-gray-500 hover:text-gray-300 hover:bg-gray-800" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add goal
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Payments due bar ===== */}
      {paymentsSummary && (
        <div className="mx-auto max-w-[1320px] px-5 md:px-10 mb-1">
          {paymentsSummary.hasDue ? (
            <div className="flex flex-wrap items-center justify-between gap-x-[22px] gap-y-[14px] rounded-[14px] px-[22px] py-[15px]"
              style={{ background: "var(--card)", border: "1px solid var(--card-bd)" }}>
              <div className="flex items-center gap-[13px]">
                <span className="text-[11px] tracking-[0.12em] uppercase" style={{ color: "var(--muted2)" }}>Payments due</span>
                <span className="w-[13px] h-[13px] rounded-full shrink-0" style={{ border: "1.5px solid var(--accent)" }} />
                <span className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{fmtMoney(paymentsSummary.totalDue)}</span>
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>· {paymentsSummary.count} payment{paymentsSummary.count === 1 ? "" : "s"}</span>
              </div>
              <div className="flex items-center gap-5 text-[12.5px]" style={{ color: "var(--muted)" }}>
                <span>Income <span style={{ color: "var(--ink3)" }}>{fmtMoney(paymentsSummary.income)}</span></span>
                <span>Day ends <span className="font-semibold" style={{ color: paymentsSummary.dayEnds >= 0 ? "#16a34a" : "var(--tag-fg)" }}>
                  {paymentsSummary.dayEnds >= 0 ? "+" : "−"}{fmtMoney(paymentsSummary.dayEnds)}
                </span></span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-[10px] px-1 pt-1.5 pb-0.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
              <span className="w-[15px] h-[15px] rounded-full flex items-center justify-center text-[9px]" style={{ border: "1.5px solid var(--accent)", color: "var(--accent)" }}>✓</span>
              Nothing due today — day ends <span className="font-semibold" style={{ color: "var(--ink3)" }}>+{fmtMoney(paymentsSummary.income)}</span>
            </div>
          )}
        </div>
      )}

      {/* ===== Priority Matrix (hero) ===== */}
      <div className="mx-auto max-w-[1320px] px-5 md:px-10 pb-16">
        <div className="flex flex-wrap items-baseline gap-3 mt-2 mb-[18px]">
          <span style={{ fontFamily: "var(--font-serif)" }} className="text-[23px] md:text-[26px]">Priority Matrix</span>
          <span className="text-[13px]" style={{ color: "var(--muted)" }}>four quadrants, one clear next move each</span>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[22px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl min-h-[300px]"
                style={{ background: "var(--surface)", border: "1px solid var(--surface-bd)", boxShadow: "0 14px 34px -20px rgba(70,55,30,0.45)", padding: "18px 22px" }}>
                <div className="skel" style={{ width: 110, height: 20, marginBottom: 22 }} />
                <div className="skel" style={{ width: "100%", height: 46, marginBottom: 18 }} />
                <div className="skel" style={{ width: "80%", height: 14, marginBottom: 11 }} />
                <div className="skel" style={{ width: "70%", height: 14, marginBottom: 11 }} />
                <div className="skel" style={{ width: "60%", height: 14 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[22px]">
            {MATRIX_ORDER.map((quadrant) => {
              const meta = MATRIX_META[quadrant];
              const { nextAction, upNext } = getQuadrantView(quadrant);
              const quickVal = quickTaskInputs[quadrant];
              return (
                <div key={quadrant} className="rounded-2xl overflow-hidden flex flex-col min-h-[300px]"
                  style={{ background: "var(--surface)", border: "1px solid var(--surface-bd)", boxShadow: "0 14px 34px -20px rgba(70,55,30,0.45)" }}>
                  {/* quadrant header */}
                  <div className="flex items-start justify-between px-[22px] py-[15px]" style={{ borderBottom: "1px solid var(--line2)" }}>
                    <div>
                      <div className="flex items-center gap-[9px]">
                        <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: meta.color }} />
                        <span style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[24px] leading-tight">{meta.name}</span>
                      </div>
                      <div className="text-[11px] tracking-[0.12em] uppercase mt-[3px] ml-[18px]" style={{ color: "var(--muted3)" }}>{meta.subtitle}</div>
                    </div>
                    <span style={{ fontFamily: "var(--font-serif)", color: "var(--num)" }} className="text-[15px]">{meta.index}</span>
                  </div>
                  {/* quadrant body */}
                  <div className="px-[22px] pt-5 pb-[22px] flex-1 flex flex-col">
                    {nextAction ? (
                      <>
                        <div style={{ borderLeft: `2px solid ${meta.color}`, paddingLeft: 14 }} className="cursor-pointer" onClick={() => void openTaskForEdit(nextAction)}>
                          <span className="text-[11px] tracking-[0.1em] uppercase" style={{ color: "var(--muted3)" }}>{meta.nextLabel}</span>
                          <div className="text-[17px] font-semibold mt-[3px]" style={{ color: "var(--ink)", textDecoration: nextAction.status === "completed" ? "line-through" : undefined }}>
                            {nextAction.title}
                            {isTaskOverdue(nextAction) && nextAction.dueDate && (
                              <span className="text-[12px] font-normal" style={{ color: "var(--tag-fg)" }}> · overdue {format(new Date(nextAction.dueDate), "MMM d")}</span>
                            )}
                          </div>
                        </div>
                        {upNext.length > 0 && (
                          <div className="mt-4 pt-[15px]" style={{ borderTop: "1px solid var(--line2)" }}>
                            <div className="text-[10px] tracking-[0.12em] uppercase mb-3" style={{ color: "var(--muted4)" }}>Up next</div>
                            <div className="flex flex-col gap-[11px]">
                              {upNext.slice(0, 6).map((t) => (
                                <div key={t._id} className="flex items-center gap-[11px]">
                                  <span className={cn("qcheck", t.status === "completed" && "checked")} onClick={() => void handleToggleComplete(t)} />
                                  <span className="text-[14px] cursor-pointer" onClick={() => void openTaskForEdit(t)}
                                    style={{ color: t.status === "completed" ? "var(--strike)" : "var(--ink3)", textDecoration: t.status === "completed" ? "line-through" : undefined }}>
                                    {t.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="pt-[18px] pb-2">
                        <div className="text-[15px]" style={{ color: "var(--ink3)" }}>{meta.emptyTitle}</div>
                        <div className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>{meta.emptySub}</div>
                      </div>
                    )}
                    {/* quick add */}
                    <div className="mt-auto pt-[18px]">
                      <div className="hovrow flex items-center gap-[9px] px-3 py-[9px] rounded-[10px]"
                        style={{ border: "1px dashed var(--dash)" }}>
                        <span className="text-[15px] leading-none" style={{ color: "var(--muted3)" }}>+</span>
                        <input
                          type="text"
                          value={quickVal}
                          placeholder={meta.addLabel}
                          onChange={(e) => setQuickTaskInputs(prev => ({ ...prev, [quadrant]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && quickVal.trim()) void handleQuickAddTask(quadrant, quickVal);
                          }}
                          className="bg-transparent outline-none text-[13px] w-full placeholder:text-[color:var(--muted3)]"
                          style={{ color: "var(--ink)" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => openModalForQuadrant("urgent-important")}
        className="cta fixed bottom-20 right-4 md:bottom-24 md:right-6 p-3 md:p-4 rounded-full shadow-lg transition-colors z-40"
        style={{ background: "var(--btn-primary)", color: "var(--btn-fg)" }}
        title="Add a task"
      >
        <Plus className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={cn(
            "w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto rounded-lg p-4 md:p-6",
            isDarkMode ? "bg-gray-900" : "bg-white"
          )}>
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-semibold">
                {editingTask ? "Edit Task" : "Add New Task"}
              </h2>
              <button
                onClick={closeModal}
                className={cn(
                  "p-1.5 md:p-2 rounded-lg",
                  isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
                )}
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            <div className="space-y-3 md:space-y-4">
              <div>
                <label className={cn("block text-sm font-medium mb-2",
                  isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Task Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title..."
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                    darkMode
                      ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                  )}
                />
              </div>

              <div>
                <label className={cn("block text-sm font-medium mb-2",
                  isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add task description..."
                  rows={3}
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                    darkMode 
                      ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                  )}
                />
              </div>

              <div>
                <label className={cn("block text-sm font-medium mb-2",
                  isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Quadrant
                </label>
                <select
                  value={formData.quadrant}
                  onChange={(e) => {
                    const newQuadrant = e.target.value as TaskQuadrant;
                    setFormData(prev => ({
                      ...prev,
                      quadrant: newQuadrant,
                      priority: newQuadrant === "urgent-important" ? "high" : prev.priority
                    }));
                  }}
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                    darkMode
                      ? "bg-gray-800 border-gray-700 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  )}
                >
                  <option value="urgent-important">Urgent & Important</option>
                  <option value="important-not-urgent">Important & Not Urgent</option>
                  <option value="urgent-not-important">Urgent & Not Important</option>
                  <option value="not-urgent-not-important">Not Urgent & Not Important</option>
                </select>
              </div>

              {formData.quadrant !== "urgent-important" && (
                <div>
                  <label className={cn("block text-sm font-medium mb-2",
                    isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      darkMode
                        ? "bg-gray-800 border-gray-700 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              )}

              {(goals.length > 0 || formData.goalId) && (
                <div>
                  <label className={cn("block text-sm font-medium mb-2",
                    isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Goal (optional)
                  </label>
                  <select
                    value={formData.goalId}
                    onChange={(e) => setFormData(prev => ({ ...prev, goalId: e.target.value }))}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      darkMode
                        ? "bg-gray-800 border-gray-700 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  >
                    {renderGoalSelectOptions(formData.goalId)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cn("block text-sm font-medium mb-2",
                    isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Due Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      min={format(new Date(), "yyyy-MM-dd")}
                      value={formData.dueDate}
                      onChange={(e) => {
                        // Ignore past dates — scheduling is forward-only
                        if (e.target.value && e.target.value < format(new Date(), "yyyy-MM-dd")) return;
                        setFormData(prev => ({ ...prev, dueDate: e.target.value }));
                      }}
                      className={cn(
                        "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        darkMode
                          ? "bg-gray-800 border-gray-700 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                    {formData.dueDate && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, dueDate: "", dueTime: "12:00" }))}
                        className={cn(
                          "absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors",
                          isDarkMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-500"
                        )}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className={cn("block text-sm font-medium mb-2",
                    isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueTime: e.target.value }))}
                    disabled={!formData.dueDate}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      darkMode
                        ? "bg-gray-800 border-gray-700 text-white disabled:opacity-50"
                        : "bg-white border-gray-300 text-gray-900 disabled:opacity-50"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className={cn("block text-sm font-medium mb-2",
                isDarkMode ? "text-gray-300" : "text-gray-700")}>
                Duration (minutes)
              </label>
              <select
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value ? Number(e.target.value) : "" }))}
                className={cn(
                  "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                  darkMode
                    ? "bg-gray-800 border-gray-700 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                )}
              >
                <option value="">No duration</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
                <option value="240">4 hours</option>
                <option value="480">8 hours</option>
              </select>
            </div>

            {/* Subtasks Section - Only show when editing a parent task */}
            {editingTask && !editingTask.parentTaskId && (
              <div className={cn("mt-4 pt-4 border-t", isDarkMode ? "border-gray-700" : "border-gray-200")}>
                <div className="flex items-center justify-between mb-3">
                  <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Subtasks
                  </label>
                  {(subtasks.length > 0 || (editingTask.subtaskCount ?? 0) > 0) && (
                    <span className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                      {subtasks.filter(s => s.status === "completed").length}/{subtasks.length} completed
                    </span>
                  )}
                </div>

                {/* Subtask List */}
                {subtasksLoading ? (
                  <div className="space-y-2 mb-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg",
                          isDarkMode ? "bg-gray-800" : "bg-gray-100"
                        )}
                      >
                        <div className={cn("w-4 h-4 rounded-full animate-pulse", isDarkMode ? "bg-gray-700" : "bg-gray-300")} />
                        <div className={cn("flex-1 h-4 rounded animate-pulse", isDarkMode ? "bg-gray-700" : "bg-gray-300")} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 mb-3">
                    {subtasks.map((subtask) => (
                      <div
                        key={subtask._id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg",
                          isDarkMode ? "bg-gray-800" : "bg-gray-100"
                        )}
                      >
                        <button
                          onClick={() => handleToggleSubtaskComplete(subtask)}
                          className={cn(
                            "rounded-full transition-colors flex-shrink-0",
                            subtask.status === "completed" ? "text-green-500" : isDarkMode ? "text-gray-400" : "text-gray-500"
                          )}
                        >
                          {subtask.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-current" />
                          )}
                        </button>
                        {editingSubtaskId === subtask._id ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingSubtaskTitle}
                            onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                            onBlur={() => void handleUpdateSubtaskTitle(subtask._id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleUpdateSubtaskTitle(subtask._id);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEditSubtask();
                              }
                            }}
                            className={cn(
                              "flex-1 text-sm px-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500",
                              isDarkMode ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                            )}
                          />
                        ) : (
                          <span
                            onClick={() => startEditSubtask(subtask)}
                            className={cn(
                              "flex-1 text-sm cursor-text",
                              subtask.status === "completed" && "line-through opacity-60"
                            )}
                          >
                            {subtask.title}
                          </span>
                        )}
                        {editingSubtaskId !== subtask._id && (
                          <button
                            onClick={() => startEditSubtask(subtask)}
                            className={cn(
                              "p-1 rounded transition-colors flex-shrink-0",
                              isDarkMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-500"
                            )}
                            aria-label="Edit subtask"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSubtask(subtask._id)}
                          className={cn(
                            "p-1 rounded transition-colors flex-shrink-0",
                            isDarkMode ? "hover:bg-red-500/20 text-red-400" : "hover:bg-red-50 text-red-500"
                          )}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Subtask Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a subtask..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newSubtaskTitle.trim()) {
                        e.preventDefault();
                        void handleAddSubtask();
                      }
                    }}
                    className={cn(
                      "flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      isDarkMode ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                    )}
                  />
                  <button
                    onClick={() => void handleAddSubtask()}
                    disabled={!newSubtaskTitle.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                  darkMode 
                    ? "bg-gray-800 hover:bg-gray-700 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                )}
              >
                Cancel
              </button>
              <button
                onClick={editingTask ? handleUpdateTask : handleAddTask}
                disabled={!formData.title || (taskOperationLoading.addTask ?? taskOperationLoading.updateTask)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(taskOperationLoading.addTask ?? taskOperationLoading.updateTask)
                  ? "Processing..." 
                  : editingTask ? "Update Task" : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <Dialog.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content
            className={cn(
              "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-xl shadow-xl p-6",
              isDarkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
            )}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-600/20">
                  <Settings className="w-5 h-5 text-gray-400" />
                </div>
                <Dialog.Title className="text-lg font-semibold">Settings</Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button className={cn("p-2 rounded-lg", isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}>
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            <Dialog.Description className="sr-only">Application settings</Dialog.Description>

            <div className="space-y-6">
              {/* Gemini API Key */}
              <div className="space-y-3">
                <div>
                  <label className={cn("block text-sm font-medium mb-1.5", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Google Gemini API Key
                  </label>
                  <p className={cn("text-xs mb-2", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                    Used for AI clothing suggestions. Get a free key at{" "}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      aistudio.google.com
                    </a>
                  </p>
                  <input
                    type="password"
                    value={settingsKeyInput}
                    onChange={(e) => setSettingsKeyInput(e.target.value)}
                    placeholder="AIza..."
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm",
                      isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                    )}
                  />
                </div>
                <div className="flex gap-2">
                  {geminiApiKey && (
                    <button
                      onClick={() => {
                        setGeminiApiKey("");
                        setSettingsKeyInput("");
                        safeRemoveItem("eisenq-gemini-api-key");
                        persistSettings({ geminiApiKey: "" });
                        setClothingSuggestion("");
                      }}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-colors text-red-400",
                        isDarkMode ? "bg-red-500/10 hover:bg-red-500/20" : "bg-red-50 hover:bg-red-100"
                      )}
                    >
                      Remove Key
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const trimmed = settingsKeyInput.trim();
                      if (trimmed) {
                        setGeminiApiKey(trimmed);
                        safeSetItem("eisenq-gemini-api-key", trimmed);
                        persistSettings({ geminiApiKey: trimmed });
                      }
                      setIsSettingsOpen(false);
                    }}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className={cn("border-t", isDarkMode ? "border-gray-700" : "border-gray-200")} />

              {/* iCal Calendar Feeds */}
              <div>
                <label className={cn("block text-sm font-medium mb-1.5", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Calendar Feeds (iCal)
                </label>
                <p className={cn("text-xs mb-3", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                  Add .ics feed URLs from Google Calendar, Apple Calendar, Outlook, or any iCal source.
                  Today&apos;s events will appear next to your routine.{" "}
                  For Google Calendar, use the <strong>Secret address in iCal format</strong> (Settings → calendar → Integrate calendar) — not the public URL.
                </p>
                {/* Existing URLs */}
                {icalUrls.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {icalUrls.map((url, i) => (
                      <div key={i} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs", isDarkMode ? "bg-gray-800" : "bg-gray-50")}>
                        <Calendar className={cn("w-3.5 h-3.5 flex-shrink-0", isDarkMode ? "text-gray-400" : "text-gray-500")} />
                        <span className={cn("flex-1 truncate font-mono", isDarkMode ? "text-gray-300" : "text-gray-700")}>{url}</span>
                        <button
                          onClick={() => {
                            const next = icalUrls.filter((_, j) => j !== i);
                            setIcalUrls(next);
                            safeSetItem("eisenq-ical-urls", JSON.stringify(next));
                            persistSettings({ icalUrls: next });
                            if (!next.length) setCalendarGroups([]);
                          }}
                          className={cn("flex-shrink-0 p-1 rounded transition-colors text-red-400", isDarkMode ? "hover:bg-red-500/20" : "hover:bg-red-50")}
                          aria-label="Remove calendar feed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add new URL */}
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settingsIcalInput}
                      onChange={(e) => { setSettingsIcalInput(e.target.value); setSettingsIcalError(""); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const trimmed = settingsIcalInput.trim();
                          if (!trimmed) return;
                          if (icalUrls.includes(trimmed)) { setSettingsIcalError("This URL is already added."); return; }
                          const next = [...icalUrls, trimmed];
                          setIcalUrls(next);
                          safeSetItem("eisenq-ical-urls", JSON.stringify(next));
                          persistSettings({ icalUrls: next });
                          setSettingsIcalInput("");
                          setSettingsIcalError("");
                        }
                      }}
                      placeholder="https://calendar.google.com/...ical/..."
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 text-sm",
                        settingsIcalError ? "border-red-400 focus:ring-red-400" : "focus:ring-blue-500",
                        isDarkMode ? "bg-gray-800 border-gray-700 text-white placeholder-gray-600" : "bg-white border-gray-300 placeholder-gray-400"
                      )}
                    />
                    <button
                      onClick={() => {
                        const trimmed = settingsIcalInput.trim();
                        if (!trimmed) return;
                        if (icalUrls.includes(trimmed)) { setSettingsIcalError("This URL is already added."); return; }
                        const next = [...icalUrls, trimmed];
                        setIcalUrls(next);
                        safeSetItem("eisenq-ical-urls", JSON.stringify(next));
                        persistSettings({ icalUrls: next });
                        setSettingsIcalInput("");
                        setSettingsIcalError("");
                      }}
                      disabled={!settingsIcalInput.trim()}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                  {settingsIcalError && (
                    <p className="text-xs text-red-400">{settingsIcalError}</p>
                  )}
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Eisenhower Matrix Info Modal */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={cn(
            "w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-lg p-4 md:p-6",
            isDarkMode ? "bg-gray-900" : "bg-white"
          )}>
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-600/20">
                  <Info className="w-5 h-5 text-blue-500" />
                </div>
                <h2 className="text-lg md:text-xl font-semibold">
                  The Eisenhower Matrix
                </h2>
              </div>
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className={cn(
                  "p-1.5 md:p-2 rounded-lg",
                  isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
                )}
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            <p className={cn("text-sm md:text-base mb-6", isDarkMode ? "text-gray-300" : "text-gray-600")}>
              The Eisenhower Matrix helps you prioritize tasks by urgency and importance, leading to more effective time management.
            </p>

            <div className="space-y-4">
              {/* Urgent & Important */}
              <div className={cn("p-4 rounded-lg border-l-4 border-red-500", isDarkMode ? "bg-gray-800" : "bg-red-50")}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <h3 className="font-semibold">Urgent & Important - Do First</h3>
                </div>
                <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                  These are crises, deadlines, and problems that need immediate action. Handle these tasks right away - they can&apos;t wait. Examples: deadline-driven projects, emergencies, last-minute preparations.
                </p>
              </div>

              {/* Important & Not Urgent */}
              <div className={cn("p-4 rounded-lg border-l-4 border-yellow-500", isDarkMode ? "bg-gray-800" : "bg-yellow-50")}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <h3 className="font-semibold">Important & Not Urgent - Schedule</h3>
                </div>
                <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                  These tasks are crucial for long-term success but don&apos;t have pressing deadlines. Schedule dedicated time for these - they&apos;re often neglected but most valuable. Examples: planning, relationship building, personal development, exercise.
                </p>
              </div>

              {/* Urgent & Not Important */}
              <div className={cn("p-4 rounded-lg border-l-4 border-blue-500", isDarkMode ? "bg-gray-800" : "bg-blue-50")}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <h3 className="font-semibold">Urgent & Not Important - Delegate</h3>
                </div>
                <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                  These tasks demand immediate attention but don&apos;t contribute to your major goals. Delegate these when possible or minimize time spent on them. Examples: some meetings, certain emails, minor requests from others.
                </p>
              </div>

              {/* Not Urgent & Not Important */}
              <div className={cn("p-4 rounded-lg border-l-4 border-green-500", isDarkMode ? "bg-gray-800" : "bg-green-50")}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <h3 className="font-semibold">Not Urgent & Not Important - Eliminate</h3>
                </div>
                <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                  These are time-wasters and trivial activities. Eliminate or dramatically reduce time spent on these tasks. Examples: excessive social media, busy work, time-wasting activities.
                </p>
              </div>
            </div>

            <div className={cn("mt-6 p-4 rounded-lg", isDarkMode ? "bg-gray-800" : "bg-gray-100")}>
              <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                <strong className={isDarkMode ? "text-gray-200" : "text-gray-800"}>Pro tip:</strong> Focus most of your energy on the &quot;Important & Not Urgent&quot; quadrant. These tasks drive long-term success and prevent crises from occurring in the first place.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={cn(
        "border-t py-6 mt-8",
        isDarkMode ? "border-gray-800 bg-gray-900/50" : "border-gray-200 bg-white/50"
      )}>
        <div className="px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-500")}>
              {new Date().getFullYear()} All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                Created by
              </span>
              <a
                href="https://www.lumeve.ca/"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-sm font-medium transition-colors",
                  darkMode
                    ? "text-blue-400 hover:text-blue-300"
                    : "text-blue-600 hover:text-blue-700"
                )}
              >
                Lumeve
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: isDarkMode ? '#1f2937' : '#fff',
            color: isDarkMode ? '#fff' : '#111827',
            border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: isDarkMode ? '#1f2937' : '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: isDarkMode ? '#1f2937' : '#fff',
            },
          },
        }}
      />
    </div>
  );
}