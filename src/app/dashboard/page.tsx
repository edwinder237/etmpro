"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search,
  Sun,
  Moon,
  Settings,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  CalendarDays,
  CalendarRange,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Share2,
  Download,
  Repeat,
  Edit3,
  Cloud,
  MapPin,
  Loader2,
  Copy,
  Star
} from "lucide-react";
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
  addYears,
  subYears,
  addDays,
  subDays,
  isToday,
  startOfDay,
  endOfDay
} from "date-fns";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import { addToCalendar } from "~/lib/calendar-export";
import toast, { Toaster } from "react-hot-toast";
import { UserButton, useUser } from "@clerk/nextjs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
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

type GoalPeriodType = "week" | "month" | "year" | "custom";
type GoalStatus = "active" | "achieved" | "dropped";

interface Goal {
  _id: string;
  title: string;
  note?: string;
  periodType: GoalPeriodType;
  periodKey: string;
  startDate?: string;
  endDate?: string;
  status: GoalStatus;
  pinned?: boolean;
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

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function safeRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  // Use dark mode as default during SSR/initial render to prevent flash
  const isDarkMode = darkMode ?? true;
  const { user } = useUser();
  const { playCompletionSound, playUncompleteSound } = useAudioFeedback();
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [taskOperationLoading, setTaskOperationLoading] = useState<Record<string, boolean>>({});
  const [quadrantLoading, setQuadrantLoading] = useState<Record<TaskQuadrant, boolean>>({
    "urgent-important": false,
    "important-not-urgent": false,
    "urgent-not-important": false,
    "not-urgent-not-important": false,
  });
  const [hideCompleted] = useState<Record<TaskQuadrant, boolean>>({
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

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [settingsKeyInput, setSettingsKeyInput] = useState("");
  const [icalUrls, setIcalUrls] = useState<string[]>([]);
  const [settingsIcalInput, setSettingsIcalInput] = useState("");
  const [settingsIcalError, setSettingsIcalError] = useState("");
  // Settings modal edits are staged as drafts and applied together on Save
  const [draftIcalUrls, setDraftIcalUrls] = useState<string[]>([]);

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
  const [locationInput, setLocationInput] = useState("");
  const [clothingSuggestion, setClothingSuggestion] = useState("");
  const [clothingLoading, setClothingLoading] = useState(false);

  // Checklist state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [showChecklistForm, setShowChecklistForm] = useState(false);
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

  // Calm Editorial redesign drawers
  const [routineDrawerOpen, setRoutineDrawerOpen] = useState(false);
  const [paymentsDrawerOpen, setPaymentsDrawerOpen] = useState(false);

  // Goals state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
  const [goalsPanelPeriodType, setGoalsPanelPeriodType] = useState<GoalPeriodType>("week");
  const [goalsPanelDate, setGoalsPanelDate] = useState(new Date());
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFormData, setGoalFormData] = useState({ title: "", note: "", parentGoalId: "", startDate: "", endDate: "" });

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
  // Reschedule an overdue task to tomorrow, keeping its original time of day.
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

  // Whether the Settings drafts differ from the applied values
  const settingsDirty =
    locationInput.trim() !== weatherLocation ||
    settingsKeyInput.trim() !== geminiApiKey ||
    draftIcalUrls.length !== icalUrls.length ||
    draftIcalUrls.some((u, i) => u !== icalUrls[i]);

  // Apply all staged Settings drafts at once
  const handleSaveSettings = () => {
    const loc = locationInput.trim();
    if (loc && loc !== weatherLocation) {
      setWeatherLocation(loc);
      safeSetItem("eisenq-weather-location", loc);
    }
    const key = settingsKeyInput.trim();
    if (key !== geminiApiKey) {
      if (key) {
        setGeminiApiKey(key);
        safeSetItem("eisenq-gemini-api-key", key);
        persistSettings({ geminiApiKey: key });
      } else {
        setGeminiApiKey("");
        safeRemoveItem("eisenq-gemini-api-key");
        persistSettings({ geminiApiKey: "" });
        setClothingSuggestion("");
      }
    }
    const urlsChanged =
      draftIcalUrls.length !== icalUrls.length || draftIcalUrls.some((u, i) => u !== icalUrls[i]);
    if (urlsChanged) {
      setIcalUrls(draftIcalUrls);
      safeSetItem("eisenq-ical-urls", JSON.stringify(draftIcalUrls));
      persistSettings({ icalUrls: draftIcalUrls });
      if (!draftIcalUrls.length) setCalendarGroups([]);
    }
    setSettingsIcalInput("");
    setSettingsIcalError("");
    setIsSettingsOpen(false);
  };

  // Stage a new iCal feed into the draft list (validation + dedup)
  const addDraftIcalUrl = () => {
    const trimmed = settingsIcalInput.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      setSettingsIcalError("Enter a valid URL.");
      return;
    }
    if (draftIcalUrls.includes(trimmed)) {
      setSettingsIcalError("This URL is already added.");
      return;
    }
    setDraftIcalUrls([...draftIcalUrls, trimmed]);
    setSettingsIcalInput("");
    setSettingsIcalError("");
  };

  // Lock body scroll when any modal/drawer is open
  useEffect(() => {
    const isAnyModalOpen = isModalOpen || isInfoModalOpen || isCalendarDrawerOpen || isCalendarTaskModalOpen || routineDrawerOpen || isGoalsExpanded || paymentsDrawerOpen;

    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, isInfoModalOpen, isCalendarDrawerOpen, isCalendarTaskModalOpen, routineDrawerOpen, isGoalsExpanded, paymentsDrawerOpen]);

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

  // Fetch the AI what-to-wear line for the masthead once weather + a Gemini key are available
  useEffect(() => {
    if (!weatherData || !geminiApiKey) return;
    const controller = new AbortController();
    void fetchClothingSuggestion(undefined, controller.signal);
    return () => controller.abort();
  }, [weatherData, geminiApiKey, fetchClothingSuggestion]);

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

  // Combined Today's schedule: in-app timed tasks + today's iCal calendar events
  // (calendarGroups is fetched on mount with today's bounds, across all feeds).
  const todaysCalendarEvents = calendarGroups.flatMap(g =>
    g.events.map(e => ({ ...e, calendar: g.name }))
  );
  const calendarFeedError = calendarGroups.some(g => g.error);
  type ScheduleItem =
    | { kind: "task"; id: string; time: number; task: Task }
    | { kind: "event"; id: string; time: number; event: PlanningEvent };
  const todaysScheduleItems: ScheduleItem[] = [
    ...todaysScheduledTasks.map(t => ({
      kind: "task" as const, id: t._id,
      time: t.dueDate ? new Date(t.dueDate).getTime() : 0, task: t,
    })),
    ...todaysCalendarEvents.map(e => ({
      kind: "event" as const, id: e.id,
      time: new Date(e.start).getTime(), event: e,
    })),
  ].sort((a, b) => a.time - b.time);

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
  const yearKeyOf = (d: Date) => format(d, "yyyy");
  const keyOfPeriod = (pt: GoalPeriodType, d: Date) =>
    pt === "week" ? weekKeyOf(d) : pt === "month" ? monthKeyOf(d) : yearKeyOf(d);
  const currentWeekKey = weekKeyOf(new Date());
  const currentMonthKey = monthKeyOf(new Date());
  const currentYearKey = yearKeyOf(new Date());
  // Custom goals aren't navigable by a single period; the panel lists them all.
  const isCustomPeriod = goalsPanelPeriodType === "custom";
  const goalsPanelKey = isCustomPeriod ? "" : keyOfPeriod(goalsPanelPeriodType, goalsPanelDate);
  const goalsPanelCurrentKey = isCustomPeriod ? "" : keyOfPeriod(goalsPanelPeriodType, new Date());
  const isViewingPastPeriod = !isCustomPeriod && goalsPanelKey < goalsPanelCurrentKey;

  const currentWeekGoals = goals.filter(g => g.periodType === "week" && g.periodKey === currentWeekKey);
  const currentMonthGoals = goals.filter(g => g.periodType === "month" && g.periodKey === currentMonthKey);
  const currentYearGoals = goals.filter(g => g.periodType === "year" && g.periodKey === currentYearKey);
  const goalsPanelGoals = isCustomPeriod
    ? goals
        .filter(g => g.periodType === "custom")
        .sort((a, b) => (a.endDate ?? "").localeCompare(b.endDate ?? ""))
    : goals.filter(g => g.periodType === goalsPanelPeriodType && g.periodKey === goalsPanelKey);

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

  // Goals selectable as the parent for the goal being added/edited in the panel.
  // Weekly goals link up to the month they fall in; monthly goals to their year.
  const parentGoalOptions = (() => {
    let candidates: Goal[] = [];
    if (goalsPanelPeriodType === "week") {
      const monthKey = goalsPanelKey.slice(0, 7);
      candidates = goals.filter(g => g.periodType === "month" && g.periodKey === monthKey && g.status === "active");
    } else if (goalsPanelPeriodType === "month") {
      const yearKey = goalsPanelKey.slice(0, 4);
      candidates = goals.filter(g => g.periodType === "year" && g.periodKey === yearKey && g.status === "active");
    } else {
      return [];
    }
    // Keep the currently-linked parent selectable when editing, even if achieved/dropped/other period
    if (editingGoal?.parentGoalId && !candidates.some(g => g._id === editingGoal.parentGoalId)) {
      const linked = goalsById.get(editingGoal.parentGoalId);
      if (linked) return [linked, ...candidates];
    }
    return candidates;
  })();
  const canLinkParent = goalsPanelPeriodType === "week" || goalsPanelPeriodType === "month";
  const parentLinkPlaceholder = goalsPanelPeriodType === "week"
    ? "Link to a monthly goal (optional)"
    : "Link to a yearly goal (optional)";

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
    setGoalFormData({ title: "", note: "", parentGoalId: "", startDate: "", endDate: "" });
    setEditingGoal(null);
    setShowGoalForm(false);
  };

  // A custom goal's date range is valid when both dates are set and ordered
  const customRangeValid = !isCustomPeriod ||
    (!!goalFormData.startDate && !!goalFormData.endDate && goalFormData.endDate >= goalFormData.startDate);

  // Set a custom range starting today, ending `days` out (30/60/90 presets)
  const applyCustomPreset = (days: number) => {
    const today = new Date();
    setGoalFormData(p => ({
      ...p,
      startDate: format(today, "yyyy-MM-dd"),
      endDate: format(addDays(today, days), "yyyy-MM-dd"),
    }));
  };

  const handleAddGoal = async () => {
    if (!goalFormData.title.trim() || !customRangeValid) return;
    setGoalsLoading(true);
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: goalFormData.title.trim(),
          note: goalFormData.note.trim() || undefined,
          periodType: goalsPanelPeriodType,
          periodKey: isCustomPeriod ? goalFormData.startDate : goalsPanelKey,
          startDate: isCustomPeriod ? goalFormData.startDate : undefined,
          endDate: isCustomPeriod ? goalFormData.endDate : undefined,
          parentGoalId: canLinkParent ? (goalFormData.parentGoalId || undefined) : undefined,
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
    if (!editingGoal || !goalFormData.title.trim() || !customRangeValid) return;
    setGoalsLoading(true);
    try {
      const response = await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: editingGoal._id,
          title: goalFormData.title.trim(),
          note: goalFormData.note.trim() || null,
          ...(editingGoal.periodType === "week" || editingGoal.periodType === "month"
            ? { parentGoalId: goalFormData.parentGoalId || null }
            : {}),
          ...(editingGoal.periodType === "custom"
            ? { startDate: goalFormData.startDate, endDate: goalFormData.endDate }
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

  const handleToggleGoalPinned = async (goal: Goal) => {
    const pinned = !goal.pinned;
    // Optimistic update
    setGoals(prev => prev.map(g => g._id === goal._id ? { ...g, pinned } : g));
    try {
      const response = await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: goal._id, pinned }),
      });
      if (!response.ok) void fetchGoals();
    } catch {
      void fetchGoals();
    }
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
    const targetKey = goal.periodType === "week" ? currentWeekKey
      : goal.periodType === "month" ? currentMonthKey
      : currentYearKey;
    // Keep the parent link only if the parent belongs to the current parent period
    const parent = goal.parentGoalId ? goalsById.get(goal.parentGoalId) : undefined;
    const parentCurrentKey = goal.periodType === "week" ? currentMonthKey : currentYearKey;
    const keepParent = parent && parent.periodKey === parentCurrentKey;
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
        const label = goal.periodType === "week" ? "this week" : goal.periodType === "month" ? "this month" : "this year";
        toast.success(`Copied to ${label}`);
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
      startDate: goal.startDate ?? "",
      endDate: goal.endDate ?? "",
    });
    setShowGoalForm(true);
  };

  const navigateGoalsPeriod = (direction: "prev" | "next") => {
    resetGoalForm();
    setGoalsPanelDate(d => {
      if (goalsPanelPeriodType === "week") {
        return direction === "prev" ? subWeeks(d, 1) : addWeeks(d, 1);
      }
      if (goalsPanelPeriodType === "month") {
        return direction === "prev" ? subMonths(d, 1) : addMonths(d, 1);
      }
      return direction === "prev" ? subYears(d, 1) : addYears(d, 1);
    });
  };

  // Compact goal row used in the "This Week / This Month" strip
  // Label for a goal option in the task-form selects, with period context for stale goals
  const goalOptionLabel = (goal: Goal) => {
    if (goal.periodType === "week" && goal.periodKey === currentWeekKey) return goal.title;
    if (goal.periodType === "month" && goal.periodKey === currentMonthKey) return goal.title;
    if (goal.periodType === "year" && goal.periodKey === currentYearKey) return goal.title;
    if (goal.periodType === "week") {
      const [y = 0, m = 1, d = 1] = goal.periodKey.split("-").map(Number);
      return `${goal.title} (week of ${format(new Date(y, m - 1, d), "MMM d")})`;
    }
    if (goal.periodType === "month") {
      const [y = 0, m = 1] = goal.periodKey.split("-").map(Number);
      return `${goal.title} (${format(new Date(y, m - 1, 1), "MMMM yyyy")})`;
    }
    if (goal.periodType === "year") {
      return `${goal.title} (${goal.periodKey})`;
    }
    // custom
    if (goal.startDate && goal.endDate) {
      return `${goal.title} (${format(new Date(goal.startDate), "MMM d")} – ${format(new Date(goal.endDate), "MMM d")})`;
    }
    return goal.title;
  };

  // Options for the "Goal (optional)" select in both task forms. Active goals of the
  // current periods are always offered; a linked goal outside those (past period,
  // achieved/dropped) stays selectable so editing never silently drops the link.
  const renderGoalSelectOptions = (selectedGoalId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const weekOptions = currentWeekGoals.filter(g => g.status === "active");
    const monthOptions = currentMonthGoals.filter(g => g.status === "active");
    const yearOptions = currentYearGoals.filter(g => g.status === "active");
    // Custom goals whose range is currently active
    const customOptions = goals.filter(g =>
      g.periodType === "custom" && g.status === "active" &&
      (g.startDate ?? "") <= today && (g.endDate ?? "") >= today);
    const selected = selectedGoalId ? goalsById.get(selectedGoalId) : undefined;
    const selectedIsListed = !!selected &&
      [weekOptions, monthOptions, yearOptions, customOptions].some(list => list.some(g => g._id === selected._id));
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
        {yearOptions.length > 0 && (
          <optgroup label="This Year">
            {yearOptions.map(g => (
              <option key={g._id} value={g._id}>{g.title}</option>
            ))}
          </optgroup>
        )}
        {customOptions.length > 0 && (
          <optgroup label="Custom">
            {customOptions.map(g => (
              <option key={g._id} value={g._id}>{goalOptionLabel(g)}</option>
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

  // Masthead focus stack: the active goals in play right now across all periods
  // (this week/month/year, plus any custom goal whose window includes today),
  // ordered by horizon. We surface the first few and link to the rest.
  const FOCUS_STACK_LIMIT = 3;
  const focusPeriodLabel: Record<GoalPeriodType, string> = { week: "Week", month: "Month", year: "Year", custom: "Custom" };
  const activeFocusGoals = (() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const order: Record<GoalPeriodType, number> = { week: 0, month: 1, year: 2, custom: 3 };
    return goals
      .filter(g => g.status === "active" && (
        (g.periodType === "week" && g.periodKey === currentWeekKey) ||
        (g.periodType === "month" && g.periodKey === currentMonthKey) ||
        (g.periodType === "year" && g.periodKey === currentYearKey) ||
        (g.periodType === "custom" && (g.startDate ?? "") <= today && (g.endDate ?? "") >= today)
      ))
      .sort((a, b) => order[a.periodType] - order[b.periodType]);
  })();
  // If any current goals are starred, the stack shows only those; otherwise it
  // falls back to the smart auto-selection so the masthead is never empty.
  const pinnedFocusGoals = activeFocusGoals.filter(g => g.pinned);
  const focusSource = pinnedFocusGoals.length > 0 ? pinnedFocusGoals : activeFocusGoals;
  const focusGoals = focusSource.slice(0, FOCUS_STACK_LIMIT);
  const focusMoreCount = focusSource.length - focusGoals.length;

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
            <button
              onClick={() => setSearchOpen(true)}
              className="searchbar flex items-center gap-2 flex-1 md:flex-none md:w-[280px] px-4 py-[9px] rounded-[11px] text-left cursor-text"
              style={{ background: "var(--drawer)", border: "1px solid var(--field-bd)" }}
            >
              <Search className="w-4 h-4" style={{ color: "var(--muted)" }} />
              <span className="text-[13px] flex-1 truncate" style={{ color: searchQuery ? "var(--ink)" : "var(--muted)" }}>
                {searchQuery || "Search tasks…"}
              </span>
              {searchQuery && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); setSearchQuery(""); }}
                  className="text-[11px] px-1.5 py-0.5 rounded"
                  style={{ background: "var(--chip)", color: "var(--muted)" }}
                >
                  clear
                </span>
              )}
            </button>
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
              <button className="navbtn" onClick={() => { setSettingsKeyInput(geminiApiKey); setLocationInput(weatherLocation); setDraftIcalUrls(icalUrls); setSettingsIcalInput(""); setSettingsIcalError(""); setIsSettingsOpen(true); }} title="Settings">
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
          {/* in focus — active goals across all periods */}
          <div className="md:text-right md:shrink-0 md:pt-2 md:min-w-[240px]">
            <div className="text-[10px] tracking-[0.14em] uppercase mb-[9px]" style={{ color: "var(--muted2)" }}>In focus</div>
            {focusGoals.length > 0 ? (
              <div className="flex flex-col gap-[13px]">
                {focusGoals.map((goal) => {
                  const counts = goalTaskCounts.get(goal._id);
                  return (
                    <div key={goal._id} onClick={() => setIsGoalsExpanded(true)} className="cursor-pointer">
                      <div className="flex items-baseline gap-2 md:justify-end">
                        <span className="text-[9px] tracking-[0.1em] uppercase shrink-0" style={{ color: "var(--muted3)" }}>{focusPeriodLabel[goal.periodType]}</span>
                        <span style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[17px] leading-[1.2]">{goal.title}</span>
                      </div>
                      {counts && counts.total > 0 && (
                        <div className="flex items-center gap-2 md:justify-end mt-[6px]">
                          <div className="w-[80px] h-[4px] rounded-full overflow-hidden" style={{ background: "var(--line3)" }}>
                            <div className="h-full" style={{ width: `${(counts.done / counts.total) * 100}%`, background: "var(--pill-active)" }} />
                          </div>
                          <span className="text-[11px]" style={{ color: "var(--muted)" }}>{counts.done} / {counts.total}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {focusMoreCount > 0 && (
                  <button onClick={() => setIsGoalsExpanded(true)} className="text-[12px] font-semibold md:text-right" style={{ color: "var(--accent)" }}>
                    +{focusMoreCount} more ›
                  </button>
                )}
              </div>
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
              "bg-[var(--drawer)] text-[var(--ink)]"
            )}
          >
            <div className="flex flex-col h-full">
              {/* Drawer Header */}
              <div className={cn("flex items-center justify-between p-4 border-b", "border-[var(--drawer-bd)]")}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#7f6a45]/20">
                    <CalendarDays className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-semibold">Task Planning</Dialog.Title>
                    <Dialog.Description className={cn("text-sm", "text-[var(--ink3)]")}>
                      Schedule and organize your tasks
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      "hover:bg-[var(--hover)] text-[var(--ink3)]"
                    )}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              {/* View Tabs */}
              <div className={cn("p-4 border-b", "border-[var(--drawer-bd)]")}>
                <div className={cn("flex rounded-lg p-1", "bg-[var(--chip)]")}>
                  <button
                    onClick={() => setCalendarView("day")}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
                      calendarView === "day"
                        ? "bg-[var(--btn-primary)] text-[var(--btn-fg)]"
                        : "text-[var(--ink3)] hover:text-[var(--ink)]"
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
                        ? "bg-[var(--btn-primary)] text-[var(--btn-fg)]"
                        : "text-[var(--ink3)] hover:text-[var(--ink)]"
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
                        ? "bg-[var(--btn-primary)] text-[var(--btn-fg)]"
                        : "text-[var(--ink3)] hover:text-[var(--ink)]"
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
                      "hover:bg-[var(--hover)] text-[var(--ink3)]"
                    )}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="text-center">
                    <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
                      {calendarView === "day" && format(selectedDate, "EEEE, MMMM d, yyyy")}
                      {calendarView === "week" && `${format(startOfWeek(selectedDate), "MMM d")} - ${format(endOfWeek(selectedDate), "MMM d, yyyy")}`}
                      {calendarView === "month" && format(selectedDate, "MMMM yyyy")}
                      {planningLoading && <Loader2 className="w-4 h-4 animate-spin text-[var(--muted)]" />}
                    </h3>
                    {isToday(selectedDate) && calendarView === "day" && (
                      <span className="text-xs text-[var(--accent)] font-medium">Today</span>
                    )}
                  </div>
                  <button
                    onClick={() => navigateCalendar("next")}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      "hover:bg-[var(--hover)] text-[var(--ink3)]"
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
                      <div className={cn("text-center py-12 rounded-lg", "bg-[var(--tint)]")}>
                        <CalendarDays className={cn("w-12 h-12 mx-auto mb-3", "text-[var(--muted)]")} />
                        <p className={cn("text-sm", "text-[var(--ink3)]")}>
                          No tasks scheduled for this day
                        </p>
                        <p className={cn("text-xs mt-1", "text-[var(--muted)]")}>
                          Add tasks with due dates to see them here
                        </p>
                      </div>
                    ) : (
                      <>
                      {showEventSkeleton && [1, 2, 3].map((i) => (
                        <div
                          key={`event-skeleton-${i}`}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-lg border-l-4 border-l-[var(--field-bd)]",
                            "bg-[var(--tint)]"
                          )}
                        >
                          <div className={cn("h-7 w-16 rounded-lg animate-pulse flex-shrink-0", "bg-[var(--line3)]")} />
                          <div className="flex-1 space-y-2">
                            <div className={cn("h-4 w-1/2 rounded animate-pulse", "bg-[var(--line3)]")} />
                            <div className={cn("h-3 w-24 rounded animate-pulse", "bg-[var(--line3)]")} />
                          </div>
                        </div>
                      ))}
                      {!showEventSkeleton && dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-lg border-l-4 border-l-[var(--accent)]",
                            "bg-[var(--tint)]"
                          )}
                        >
                          <div className={cn(
                            "flex-shrink-0 px-3 py-1 rounded-lg text-sm font-medium",
                            "bg-[var(--field)] border border-[var(--field-bd)]"
                          )}>
                            {ev.allDay ? "All day" : format(new Date(ev.start), "HH:mm")}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />
                              {ev.title}
                            </h4>
                            {ev.location && (
                              <p className={cn("text-sm mt-1", "text-[var(--ink3)]")}>
                                {ev.location}
                              </p>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded mt-2 bg-[#7f6a45]/15 text-[var(--accent)]">
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
                            "bg-[var(--tint)] hover:bg-[var(--hover)]"
                          )}
                        >
                          <div className={cn(
                            "flex-shrink-0 px-3 py-1 rounded-lg text-sm font-medium",
                            "bg-[var(--field)] border border-[var(--field-bd)]"
                          )}>
                            {task.dueDate ? format(new Date(task.dueDate), "HH:mm") : "--:--"}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{task.title}</h4>
                            <p className={cn("text-sm mt-1", "text-[var(--ink3)]")}>
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
                                <span className={cn("text-xs", "text-[var(--muted)]")}>
                                  {task.duration} min
                                </span>
                              )}
                              {task.subtaskCount !== undefined && task.subtaskCount > 0 && (
                                <span className={cn(
                                  "text-xs flex items-center gap-1",
                                  task.subtaskCompletedCount === task.subtaskCount
                                    ? "text-green-500"
                                    : "text-[var(--muted)]"
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
                      <div key={day} className={cn("text-center text-xs font-medium py-2", "text-[var(--muted)]")}>
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
                            isToday(day) && "ring-2 ring-[var(--pill-active)]",
                            "bg-[var(--tint)] border-[var(--field-bd)] hover:bg-[var(--hover)]"
                          )}
                        >
                          <div className={cn(
                            "text-sm font-medium mb-2",
                            isToday(day) ? "text-[var(--accent)]" : "text-[var(--ink2)]"
                          )}>
                            {format(day, "d")}
                          </div>
                          <div className="space-y-1">
                            {shownEvents.map((ev) => (
                              <div
                                key={ev.id}
                                data-tooltip={`${ev.allDay ? "All day" : format(new Date(ev.start), "HH:mm")} - ${ev.title} (${ev.calendar})`}
                                className="tooltip-task text-xs p-1.5 rounded truncate bg-[#7f6a45]/15 text-[var(--accent)]"
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
                                  task.quadrant === "urgent-not-important" && "bg-blue-500/20 text-[var(--accent)]",
                                  task.quadrant === "not-urgent-not-important" && "bg-green-500/20 text-green-400"
                                )}
                              >
                                {task.dueDate ? format(new Date(task.dueDate), "HH:mm") : ""} {task.title}
                              </div>
                            ))}
                            {overflow > 0 && (
                              <div className={cn("text-xs", "text-[var(--muted)]")}>
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
                        <div key={day} className={cn("text-center text-xs font-medium py-2", "text-[var(--muted)]")}>
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
                              isToday(day) && "ring-2 ring-[var(--pill-active)]",
                              !isCurrentMonth && "opacity-40",
                              darkMode
                                ? "bg-[var(--tint)] border-[var(--field-bd)] hover:bg-[var(--hover)]"
                                : "bg-[var(--tint)] border-[var(--field-bd)] hover:bg-[var(--hover)]"
                            )}
                          >
                            <div className={cn(
                              "text-xs font-medium mb-1",
                              isToday(day) ? "text-[var(--accent)]" : "text-[var(--ink2)]"
                            )}>
                              {format(day, "d")}
                            </div>
                            <div className="space-y-0.5">
                              {dayEvents.slice(0, 1).map((ev) => (
                                <div
                                  key={ev.id}
                                  data-tooltip={`${ev.allDay ? "All day" : format(new Date(ev.start), "HH:mm")} - ${ev.title} (${ev.calendar})`}
                                  className="tooltip-task text-xs p-1 rounded truncate bg-[#7f6a45]/15 text-[var(--accent)]"
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
                                    task.quadrant === "urgent-not-important" && "bg-blue-500/20 text-[var(--accent)]",
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
                                      className="tooltip-task w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
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
                                    <span className={cn("text-xs", "text-[var(--muted)]")}>
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
              <div className={cn("p-4 border-t flex gap-3", "border-[var(--drawer-bd)]")}>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    "bg-[var(--chip)] hover:brightness-95 text-[var(--ink)]"
                  )}
                >
                  Go to Today
                </button>
                <button
                  onClick={openCalendarTaskForCreate}
                  className="flex-1 px-4 py-2 bg-[var(--btn-primary)] text-[var(--btn-fg)] rounded-lg text-sm font-medium hover:brightness-95 transition-colors flex items-center justify-center gap-2"
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
              "bg-[var(--drawer)] text-[var(--ink)]"
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
                          ? "bg-[#7f6a45]/20 text-[var(--accent)] hover:brightness-110"
                          : "bg-[var(--chip)] text-[var(--accent)] hover:brightness-95"
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
                            "bg-[var(--drawer)] border border-[var(--drawer-bd)]"
                          )}
                          sideOffset={5}
                        >
                          <DropdownMenu.Item
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none",
                              "hover:bg-[var(--hover)] text-[var(--ink2)]"
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
                              "hover:bg-[var(--hover)] text-[var(--ink2)]"
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
                            <Calendar className="w-4 h-4 text-[var(--accent)]" />
                            Outlook.com
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none",
                              "hover:bg-[var(--hover)] text-[var(--ink2)]"
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
                              "hover:bg-[var(--hover)] text-[var(--ink2)]"
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
                          <DropdownMenu.Separator className={cn("h-px my-1", "bg-[var(--line3)]")} />
                          <DropdownMenu.Item
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer outline-none",
                              "hover:bg-[var(--hover)] text-[var(--ink2)]"
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
                            <Download className="w-4 h-4 text-[var(--muted)]" />
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
                    "hover:bg-[var(--hover)]"
                  )}
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </Dialog.Close>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className={cn("block text-sm font-medium mb-2", "text-[var(--ink2)]")}>
                  Task Title
                </label>
                <input
                  type="text"
                  value={calendarTaskForm.title}
                  onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title..."
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
                    darkMode
                      ? "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
                      : "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
                  )}
                />
              </div>

              {/* Description */}
              <div>
                <label className={cn("block text-sm font-medium mb-2", "text-[var(--ink2)]")}>
                  Description
                </label>
                <textarea
                  value={calendarTaskForm.description}
                  onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add task description..."
                  rows={2}
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
                    darkMode
                      ? "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
                      : "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
                  )}
                />
              </div>

              {/* Date and Time Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cn("block text-sm font-medium mb-2", "text-[var(--ink2)]")}>
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
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
                      darkMode
                        ? "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
                        : "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
                    )}
                  />
                </div>
                <div>
                  <label className={cn("block text-sm font-medium mb-2", "text-[var(--ink2)]")}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={calendarTaskForm.time}
                    onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, time: e.target.value }))}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
                      darkMode
                        ? "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
                        : "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
                    )}
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className={cn("block text-sm font-medium mb-2", "text-[var(--ink2)]")}>
                  Duration (minutes)
                </label>
                <select
                  value={calendarTaskForm.duration}
                  onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, duration: Number(e.target.value) }))}
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
                    "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
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
                <label className={cn("block text-sm font-medium mb-2", "text-[var(--ink2)]")}>
                  Quadrant
                </label>
                <select
                  value={calendarTaskForm.quadrant}
                  onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, quadrant: e.target.value as TaskQuadrant }))}
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
                    "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
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
                <label className={cn("block text-sm font-medium mb-2", "text-[var(--ink2)]")}>
                  Priority
                </label>
                <select
                  value={calendarTaskForm.priority}
                  onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
                    "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
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
                  <label className={cn("block text-sm font-medium mb-2", "text-[var(--ink2)]")}>
                    Goal (optional)
                  </label>
                  <select
                    value={calendarTaskForm.goalId}
                    onChange={(e) => setCalendarTaskForm(prev => ({ ...prev, goalId: e.target.value }))}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
                      darkMode
                        ? "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
                        : "bg-[var(--field)] border-[var(--field-bd)] text-[var(--ink)]"
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
                    "bg-[var(--chip)] hover:brightness-95 text-[var(--ink)]"
                  )}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleSaveCalendarTask}
                disabled={!calendarTaskForm.title.trim()}
                className="flex-1 px-4 py-2 bg-[var(--btn-primary)] text-[var(--btn-fg)] rounded-lg font-medium hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingCalendarTask ? "Update" : "Create"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ===== Today (routine + schedule) ===== */}
      <div className="mx-auto max-w-[1320px] px-5 md:px-10 mb-[22px]">
        <div className="flex flex-wrap items-baseline gap-3 mt-1 mb-4">
          <span style={{ fontFamily: "var(--font-serif)" }} className="text-[23px] md:text-[26px]">Today</span>
          <span className="text-[13px]" style={{ color: "var(--muted)" }}>your routine and what&apos;s on the calendar</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-[22px]">
          {/* Today's routine */}
          <div className="rounded-2xl" style={{ background: "var(--card)", border: "1px solid var(--card-bd)", padding: "22px 24px" }}>
            <div className="flex items-baseline justify-between mb-3">
              <span style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[20px]">Today&apos;s routine</span>
              <button onClick={() => setRoutineDrawerOpen(true)} className="text-[12px]" style={{ color: "var(--accent)" }}>Manage ›</button>
            </div>
            {todaysChecklistItems.length === 0 ? (
              <div className="py-1">
                <div className="text-[14px]" style={{ color: "var(--ink3)" }}>No routine yet.</div>
                <div className="text-[12.5px] mt-1 mb-3" style={{ color: "var(--muted)" }}>Add the small daily things you want to stay on top of.</div>
                <button onClick={() => setRoutineDrawerOpen(true)} className="text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>+ Build your routine</button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-[22px]">
                  <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: "var(--line3)" }}>
                    <div className="h-full rounded-full" style={{ width: `${todaysChecklistItems.length ? (completedCount / todaysChecklistItems.length) * 100 : 0}%`, background: "var(--pill-active)" }} />
                  </div>
                  <span className="text-[12px] whitespace-nowrap" style={{ color: "var(--muted)" }}>{completedCount} of {todaysChecklistItems.length} done</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-[18px]">
                  {todaysChecklistItems.map((item) => {
                    const done = isChecklistItemCompletedToday(item);
                    return (
                      <div key={item._id} className="flex items-center gap-[10px]">
                        <span className={cn("qcheck", done && "checked")} onClick={() => void handleToggleChecklistItem(item._id)} />
                        <span className="text-[13.5px]" style={{ color: done ? "var(--strike)" : "var(--ink2)", textDecoration: done ? "line-through" : undefined }}>{item.title}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          {/* Today's schedule */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--card-bd)" }}>
            <div style={{ padding: "22px 24px" }}>
              <div className="flex items-baseline justify-between mb-3">
                <span style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[17px]">Today&apos;s schedule</span>
                <button onClick={() => setIsCalendarDrawerOpen(true)} className="text-[12px]" style={{ color: "var(--accent)" }}>Open ›</button>
              </div>
              {todaysScheduleItems.length === 0 ? (
                <div className="pt-1">
                  <div className="text-[13.5px]" style={{ color: "var(--ink3)" }}>Nothing scheduled today.</div>
                  <div className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>Add a task with a time, or connect a calendar in settings.</div>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {todaysScheduleItems.map((item) => {
                    if (item.kind === "task") {
                      const t = item.task;
                      const doFirst = t.quadrant === "urgent-important";
                      return (
                        <div key={`task-${t._id}`} className="flex gap-3 cursor-pointer" onClick={() => void openTaskForEdit(t)}>
                          <span className="text-[11px] w-[52px] text-right pt-0.5 shrink-0" style={{ color: "var(--muted2)" }}>{t.dueDate ? format(new Date(t.dueDate), "h:mm") : ""}</span>
                          <div className="flex-1 pb-3 pl-[14px] ml-0.5" style={{ borderLeft: `2px solid ${doFirst ? "var(--q-do-first)" : "var(--form-bd)"}` }}>
                            <div className="flex items-center gap-2">
                              <span className="text-[13.5px]" style={{ color: "var(--ink)" }}>{t.title}</span>
                              {doFirst && <span className="text-[10px] px-[7px] py-px rounded-[5px]" style={{ color: "var(--tag-fg)", background: "var(--tag-bg)" }}>Do First</span>}
                            </div>
                            <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                              {t.dueDate ? format(new Date(t.dueDate), "h:mm a") : ""}{t.duration ? ` · ${t.duration} min` : ""}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const ev = item.event;
                    return (
                      <div key={`event-${ev.id}`} className="flex gap-3">
                        <span className="text-[11px] w-[52px] text-right pt-0.5 shrink-0" style={{ color: "var(--muted2)" }}>
                          {ev.allDay ? "all day" : format(new Date(ev.start), "h:mm")}
                        </span>
                        <div className="flex-1 pb-3 pl-[14px] ml-0.5" style={{ borderLeft: "2px solid var(--form-bd)" }}>
                          <div className="text-[13.5px]" style={{ color: "var(--ink2)" }}>{ev.title}</div>
                          <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                            {ev.allDay ? ev.calendar : `${format(new Date(ev.start), "h:mm a")} · ${ev.calendar}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {calendarFeedError && (
                    <div className="flex items-center gap-1.5 pt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
                      <AlertCircle className="w-3 h-3" />
                      A calendar feed couldn&apos;t be loaded — check its URL in settings.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Payments load failure — otherwise invisible */}
      {paymentsError && (
        <div className="mx-auto max-w-[1320px] px-5 md:px-10 mb-1">
          <div className="flex items-center gap-2 px-1 text-[12.5px]" style={{ color: "var(--muted)" }}>
            <AlertCircle className="w-3.5 h-3.5" />
            Couldn&apos;t load payments
            <button onClick={() => void fetchPaymentsDue()} className="font-semibold" style={{ color: "var(--accent)" }}>Retry</button>
          </div>
        </div>
      )}

      {/* ===== Payments due bar ===== */}
      {paymentsSummary && (
        <div className="mx-auto max-w-[1320px] px-5 md:px-10 mb-1">
          {paymentsSummary.hasDue ? (
            <div onClick={() => setPaymentsDrawerOpen(true)}
              className="flex flex-wrap items-center justify-between gap-x-[22px] gap-y-[14px] rounded-[14px] px-[22px] py-[15px] cursor-pointer"
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
                            {nextAction.dueDate && nextAction.status !== "completed" && (
                              isTaskOverdue(nextAction) ? (
                                <span className="text-[12px] font-normal" style={{ color: "var(--tag-fg)" }}> · overdue {format(new Date(nextAction.dueDate), "MMM d")}</span>
                              ) : (
                                <span className="text-[12px] font-normal" style={{ color: "var(--muted3)" }}> · {format(new Date(nextAction.dueDate), "MMM d")}</span>
                              )
                            )}
                          </div>
                        </div>
                        {upNext.length > 0 && (
                          <div className="mt-4 pt-[15px]" style={{ borderTop: "1px solid var(--line2)" }}>
                            <div className="text-[10px] tracking-[0.12em] uppercase mb-3" style={{ color: "var(--muted4)" }}>Up next</div>
                            <div className="flex flex-col gap-[11px]">
                              {upNext.map((t) => (
                                <div key={t._id} className="flex items-center gap-[11px]">
                                  <span className={cn("qcheck", t.status === "completed" && "checked")} onClick={() => void handleToggleComplete(t)} />
                                  <span className="text-[14px] cursor-pointer flex-1 min-w-0 truncate" onClick={() => void openTaskForEdit(t)}
                                    style={{ color: t.status === "completed" ? "var(--strike)" : "var(--ink3)", textDecoration: t.status === "completed" ? "line-through" : undefined }}>
                                    {t.title}
                                  </span>
                                  {t.dueDate && t.status !== "completed" && (
                                    <span className="text-[12px] font-normal shrink-0 tabular-nums"
                                      style={{ color: isTaskOverdue(t) ? "var(--tag-fg)" : "var(--muted3)" }}>
                                      {format(new Date(t.dueDate), "MMM d")}
                                    </span>
                                  )}
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

      {/* ===== Calm Editorial drawers ===== */}
      {(routineDrawerOpen || isGoalsExpanded || paymentsDrawerOpen) && (
        <div
          onClick={() => { setRoutineDrawerOpen(false); setIsGoalsExpanded(false); setPaymentsDrawerOpen(false); resetGoalForm(); }}
          className="fixed inset-0 z-[60]"
          style={{ background: "var(--overlay)", animation: "fadeIn .2s ease" }}
        />
      )}

      {/* Routine drawer */}
      {routineDrawerOpen && (
        <div className="fixed top-0 right-0 bottom-0 z-[61] w-[460px] max-w-[94vw] overflow-y-auto"
          style={{ background: "var(--drawer)", borderLeft: "1px solid var(--drawer-bd)", boxShadow: "-24px 0 60px -30px rgba(70,55,30,0.4)", animation: "drawerIn .28s cubic-bezier(.16,1,.3,1)" }}>
          <div className="flex items-start justify-between" style={{ padding: "24px 26px 0" }}>
            <div>
              <div style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[24px]">Routines &amp; Maintenance</div>
              <div className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>Recurring items that reset on their own schedule.</div>
            </div>
            <button onClick={() => { setRoutineDrawerOpen(false); resetChecklistForm(); resetMaintenanceForm(); }} className="p-1 text-[20px]" style={{ color: "var(--muted)" }}>✕</button>
          </div>
          <div className="flex gap-1.5" style={{ padding: "18px 26px 0" }}>
            {(["today", "all", "maintenance"] as const).map((tab) => (
              <button key={tab} onClick={() => setChecklistTab(tab)}
                className="text-[13px] rounded-[9px] capitalize"
                style={{ padding: "7px 15px", fontWeight: checklistTab === tab ? 600 : 400, color: checklistTab === tab ? "var(--btn-fg)" : "var(--accent)", background: checklistTab === tab ? "var(--pill-active)" : "var(--chip)" }}>
                {tab}
              </button>
            ))}
          </div>

          {checklistTab !== "maintenance" && (
            <div style={{ padding: "14px 20px 4px" }} className="flex flex-col">
              {(checklistTab === "all" ? checklistItems : todaysChecklistItems).length === 0 && (
                <div className="text-[13.5px] px-2 py-3" style={{ color: "var(--muted)" }}>No routine items yet.</div>
              )}
              {(checklistTab === "all" ? checklistItems : todaysChecklistItems).map((item) => {
                const done = isChecklistItemCompletedToday(item);
                const badge = item.frequency === "daily" ? "daily" : (item.daysOfWeek?.length ? item.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ") : "weekly");
                return (
                  <div key={item._id} className="flex items-center gap-[10px] rounded-[10px]" style={{ padding: "10px 8px" }}>
                    <span className={cn("qcheck", done && "checked")} onClick={() => void handleToggleChecklistItem(item._id)} />
                    <span className="flex-1 text-[14px]" style={{ color: done ? "var(--strike)" : "var(--ink2)", textDecoration: done ? "line-through" : undefined }}>{item.title}</span>
                    <span className="text-[11px] rounded-[6px]" style={{ padding: "2px 9px", color: "var(--muted)", background: "var(--chip)" }}>{badge}</span>
                    <button onClick={() => openChecklistItemForEdit(item)} style={{ color: "var(--muted2)" }} className="text-[13px] p-0.5"><Edit3 className="w-[15px] h-[15px]" /></button>
                    <button onClick={() => void handleDeleteChecklistItem(item._id)} style={{ color: "var(--tag-fg)" }} className="p-0.5"><Trash2 className="w-[15px] h-[15px]" /></button>
                  </div>
                );
              })}
              {showChecklistForm ? (
                <div className="rounded-[14px] mt-2" style={{ margin: "8px 2px 20px", padding: "18px", background: "var(--form-bg)", border: "1px solid var(--form-bd)" }}>
                  <div style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[16px] mb-3">{editingChecklistItem ? "Edit routine item" : "New routine item"}</div>
                  <input type="text" autoFocus placeholder="e.g. Drink water" value={checklistFormData.title}
                    onChange={(e) => setChecklistFormData((p) => ({ ...p, title: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter" && checklistFormData.title.trim()) void (editingChecklistItem ? handleUpdateChecklistItem() : handleAddChecklistItem()); }}
                    className="w-full text-[13.5px] rounded-[10px] outline-none mb-3" style={{ padding: "11px 14px", background: "var(--field)", border: "1px solid var(--field-bd)", color: "var(--ink)" }} />
                  <div className="flex gap-2 mb-3">
                    {(["daily", "weekly"] as const).map((f) => (
                      <button key={f} onClick={() => setChecklistFormData((p) => ({ ...p, frequency: f, daysOfWeek: f === "daily" ? [] : p.daysOfWeek }))}
                        className="text-[12.5px] rounded-[9px] capitalize" style={{ padding: "7px 16px", fontWeight: checklistFormData.frequency === f ? 600 : 400, color: checklistFormData.frequency === f ? "var(--btn-fg)" : "var(--accent)", background: checklistFormData.frequency === f ? "var(--pill-active)" : "var(--chip)" }}>{f}</button>
                    ))}
                  </div>
                  {checklistFormData.frequency === "weekly" && (
                    <div className="flex gap-1.5 mb-3">
                      {DAY_LABELS.map((label, i) => (
                        <button key={label} onClick={() => setChecklistFormData((p) => ({ ...p, daysOfWeek: p.daysOfWeek.includes(i) ? p.daysOfWeek.filter((d) => d !== i) : [...p.daysOfWeek, i] }))}
                          className="w-[30px] h-[30px] rounded-[8px] text-[12px] flex items-center justify-center"
                          style={{ border: "1px solid var(--field-bd)", color: checklistFormData.daysOfWeek.includes(i) ? "var(--btn-fg)" : "var(--muted5)", background: checklistFormData.daysOfWeek.includes(i) ? "var(--pill-active)" : "transparent" }}>{label.charAt(0)}</button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2.5 mt-1">
                    <button onClick={editingChecklistItem ? handleUpdateChecklistItem : handleAddChecklistItem} disabled={!checklistFormData.title.trim() || checklistLoading}
                      className="cta text-[13px] font-semibold rounded-[10px] disabled:opacity-50" style={{ padding: "9px 20px", color: "var(--btn-fg)", background: "var(--btn-primary)" }}>{checklistLoading ? "Saving…" : editingChecklistItem ? "Update" : "Add item"}</button>
                    <button onClick={resetChecklistForm} className="text-[13px]" style={{ padding: "9px 16px", color: "var(--accent)" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowChecklistForm(true)} className="hovrow text-[13px] text-center rounded-[11px] mt-2" style={{ margin: "8px 2px 20px", padding: "11px", border: "1px dashed var(--check-bd)", color: "var(--muted5)" }}>+ Add a routine item</button>
              )}
            </div>
          )}

          {checklistTab === "maintenance" && (
            <div style={{ padding: "14px 20px 20px" }} className="flex flex-col gap-2">
              {maintenanceItems.length === 0 && <div className="text-[13.5px] px-2 py-2" style={{ color: "var(--muted)" }}>No maintenance items yet.</div>}
              {maintenanceItems.map((m) => (
                <div key={m._id} className="flex items-center gap-3 rounded-[11px]" style={{ padding: "12px 14px", background: "var(--field)", border: "1px solid var(--field-bd)" }}>
                  <div className="flex-1">
                    <div className="text-[14px]" style={{ color: "var(--ink)" }}>{m.title}</div>
                    <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>every {m.intervalDays} days · due {format(new Date(m.nextDueDate), "MMM d")}</div>
                  </div>
                  <button onClick={() => void handleMarkMaintenanceDone(m._id)} className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>Mark done</button>
                  <button onClick={() => void handleDeleteMaintenanceItem(m._id)} style={{ color: "var(--tag-fg)" }} className="p-0.5"><Trash2 className="w-[15px] h-[15px]" /></button>
                </div>
              ))}
              {showMaintenanceForm ? (
                <div className="rounded-[14px]" style={{ padding: "16px", background: "var(--form-bg)", border: "1px solid var(--form-bd)" }}>
                  <input type="text" autoFocus placeholder="e.g. Replace furnace filter" value={maintenanceFormData.title}
                    onChange={(e) => setMaintenanceFormData((p) => ({ ...p, title: e.target.value }))}
                    className="w-full text-[13.5px] rounded-[10px] outline-none mb-2.5" style={{ padding: "11px 14px", background: "var(--field)", border: "1px solid var(--field-bd)", color: "var(--ink)" }} />
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {INTERVAL_PRESETS.map((p) => (
                      <button key={p.label} onClick={() => setMaintenanceFormData((f) => ({ ...f, intervalDays: p.days }))}
                        className="text-[12px] rounded-[8px]" style={{ padding: "6px 12px", color: maintenanceFormData.intervalDays === p.days ? "var(--btn-fg)" : "var(--accent)", background: maintenanceFormData.intervalDays === p.days ? "var(--pill-active)" : "var(--chip)" }}>{p.label}</button>
                    ))}
                  </div>
                  <input type="date" value={maintenanceFormData.nextDueDate} onChange={(e) => setMaintenanceFormData((p) => ({ ...p, nextDueDate: e.target.value }))}
                    className="w-full text-[13.5px] rounded-[10px] outline-none mb-3" style={{ padding: "10px 14px", background: "var(--field)", border: "1px solid var(--field-bd)", color: "var(--ink)" }} />
                  <div className="flex gap-2.5">
                    <button onClick={editingMaintenanceItem ? handleUpdateMaintenanceItem : handleAddMaintenanceItem} disabled={!maintenanceFormData.title.trim()}
                      className="cta text-[13px] font-semibold rounded-[10px] disabled:opacity-50" style={{ padding: "9px 20px", color: "var(--btn-fg)", background: "var(--btn-primary)" }}>{editingMaintenanceItem ? "Update" : "Add"}</button>
                    <button onClick={resetMaintenanceForm} className="text-[13px]" style={{ padding: "9px 16px", color: "var(--accent)" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowMaintenanceForm(true)} className="hovrow text-[13px] text-center rounded-[11px]" style={{ padding: "11px", border: "1px dashed var(--check-bd)", color: "var(--muted5)" }}>+ Add a maintenance item</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Goals drawer */}
      {isGoalsExpanded && (
        <div className="fixed top-0 right-0 bottom-0 z-[61] w-[460px] max-w-[94vw] overflow-y-auto"
          style={{ background: "var(--drawer)", borderLeft: "1px solid var(--drawer-bd)", boxShadow: "-24px 0 60px -30px rgba(70,55,30,0.4)", animation: "drawerIn .28s cubic-bezier(.16,1,.3,1)" }}>
          <div className="flex items-start justify-between" style={{ padding: "24px 26px 0" }}>
            <div>
              <div style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[24px]">Goals</div>
              <div className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>What you want to focus on and achieve.</div>
            </div>
            <button onClick={() => { setIsGoalsExpanded(false); resetGoalForm(); }} className="p-1 text-[20px]" style={{ color: "var(--muted)" }}>✕</button>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-y-2 gap-x-3" style={{ padding: "18px 26px 0" }}>
            <div className="inline-flex rounded-[9px] p-0.5" style={{ background: "var(--chip)" }}>
              {([["week", "Week"], ["month", "Month"], ["year", "Year"], ["custom", "Custom"]] as const).map(([pt, label]) => (
                <button key={pt} onClick={() => { setGoalsPanelPeriodType(pt); resetGoalForm(); }}
                  className="text-[12.5px] rounded-[7px]" style={{ padding: "6px 12px", fontWeight: goalsPanelPeriodType === pt ? 600 : 400, color: goalsPanelPeriodType === pt ? "var(--btn-fg)" : "var(--accent)", background: goalsPanelPeriodType === pt ? "var(--pill-active)" : "transparent" }}>{label}</button>
              ))}
            </div>
            {!isCustomPeriod && (
              <div className="flex items-center gap-1">
                <button onClick={() => navigateGoalsPeriod("prev")} className="navbtn" style={{ width: 30, height: 30 }}><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-[12px] text-center min-w-[120px]" style={{ color: "var(--ink2)" }}>
                  {goalsPanelPeriodType === "week"
                    ? `${format(startOfWeek(goalsPanelDate, { weekStartsOn: 0 }), "MMM d")} – ${format(endOfWeek(goalsPanelDate, { weekStartsOn: 0 }), "MMM d")}`
                    : goalsPanelPeriodType === "month"
                      ? format(goalsPanelDate, "MMMM yyyy")
                      : format(goalsPanelDate, "yyyy")}
                </span>
                <button onClick={() => navigateGoalsPeriod("next")} className="navbtn" style={{ width: 30, height: 30 }}><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
          <div style={{ padding: "14px 22px 4px" }} className="flex flex-col gap-1.5">
            {goalsPanelGoals.length === 0 && !showGoalForm && (
              <div className="text-center rounded-[12px] text-[13px]" style={{ padding: "20px", border: "1px dashed var(--dash2)", color: "var(--muted)" }}>{isCustomPeriod ? "No custom goals yet." : `No goals this ${goalsPanelPeriodType}.`}</div>
            )}
            {goalsPanelGoals.map((goal) => {
              const counts = goalTaskCounts.get(goal._id);
              const parent = goal.parentGoalId ? goalsById.get(goal.parentGoalId) : undefined;
              const rangeLabel = goal.periodType === "custom" && goal.startDate && goal.endDate
                ? `${format(new Date(goal.startDate), "MMM d")} – ${format(new Date(goal.endDate), "MMM d, yyyy")}`
                : null;
              return (
                <div key={goal._id} className="flex items-start gap-2.5 rounded-[11px]" style={{ padding: "12px 14px", background: "var(--field)", border: "1px solid var(--field-bd)", opacity: goal.status === "dropped" ? 0.55 : 1 }}>
                  <span className={cn("qcheck", goal.status === "achieved" && "checked")} style={{ marginTop: 3 }} onClick={() => handleToggleGoalAchieved(goal)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px]" style={{ color: "var(--ink)", textDecoration: goal.status !== "active" ? "line-through" : undefined }}>{goal.title}</div>
                    {rangeLabel && <div className="text-[11.5px] mt-0.5" style={{ color: "var(--accent)" }}>{rangeLabel}</div>}
                    {goal.note && <div className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>{goal.note}</div>}
                    <div className="flex items-center gap-2 mt-1">
                      {counts && <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>{counts.done} / {counts.total} tasks</span>}
                      {parent && <span className="text-[11px]" style={{ color: "var(--accent)" }}>↳ {parent.title}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => void handleToggleGoalPinned(goal)} title={goal.pinned ? "Remove from focus" : "Show in focus"} className="p-0.5"
                      style={{ color: goal.pinned ? "var(--accent)" : "var(--muted2)" }}>
                      <Star className="w-[14px] h-[14px]" style={{ fill: goal.pinned ? "var(--accent)" : "none" }} />
                    </button>
                    {isViewingPastPeriod && goal.status === "active" && (
                      <button onClick={() => void handleCopyGoalToCurrentPeriod(goal)} title="Copy to current" style={{ color: "var(--accent)" }} className="p-0.5"><Copy className="w-[14px] h-[14px]" /></button>
                    )}
                    <button onClick={() => openGoalForEdit(goal)} style={{ color: "var(--muted2)" }} className="p-0.5"><Edit3 className="w-[14px] h-[14px]" /></button>
                    <button onClick={() => void handleSetGoalStatus(goal, goal.status === "dropped" ? "active" : "dropped")} style={{ color: "var(--muted2)" }} className="p-0.5">{goal.status === "dropped" ? <Repeat className="w-[14px] h-[14px]" /> : <X className="w-[14px] h-[14px]" />}</button>
                    <button onClick={() => void handleDeleteGoal(goal._id)} style={{ color: "var(--tag-fg)" }} className="p-0.5"><Trash2 className="w-[14px] h-[14px]" /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "6px 22px 26px" }}>
            {showGoalForm ? (
              <div className="rounded-[14px]" style={{ padding: "18px", background: "var(--form-bg)", border: "1px solid var(--form-bd)" }}>
                <div style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[16px] mb-3">{editingGoal ? "Edit goal" : "New goal"}</div>
                <input type="text" autoFocus placeholder={goalsPanelPeriodType === "week" ? "What to achieve this week?" : goalsPanelPeriodType === "month" ? "What to achieve this month?" : goalsPanelPeriodType === "year" ? "What to achieve this year?" : "What to achieve in this window?"} value={goalFormData.title}
                  onChange={(e) => setGoalFormData((p) => ({ ...p, title: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter" && goalFormData.title.trim() && customRangeValid) void (editingGoal ? handleUpdateGoal() : handleAddGoal()); }}
                  className="w-full text-[13.5px] rounded-[10px] outline-none mb-2.5" style={{ padding: "11px 14px", background: "var(--field)", border: "1px solid var(--field-bd)", color: "var(--ink)" }} />
                <input type="text" placeholder="Why it matters · optional" value={goalFormData.note}
                  onChange={(e) => setGoalFormData((p) => ({ ...p, note: e.target.value }))}
                  className="w-full text-[13.5px] rounded-[10px] outline-none mb-2.5" style={{ padding: "11px 14px", background: "var(--field)", border: "1px solid var(--field-bd)", color: "var(--ink)" }} />
                {isCustomPeriod && (
                  <div className="mb-3">
                    <div className="flex gap-2 mb-2">
                      <label className="flex-1">
                        <span className="text-[11px] tracking-[0.06em] uppercase block mb-1" style={{ color: "var(--muted5)" }}>Start</span>
                        <input type="date" value={goalFormData.startDate}
                          onChange={(e) => setGoalFormData((p) => ({ ...p, startDate: e.target.value }))}
                          className="w-full text-[13px] rounded-[10px] outline-none" style={{ padding: "9px 12px", background: "var(--field)", border: "1px solid var(--field-bd)", color: "var(--ink)" }} />
                      </label>
                      <label className="flex-1">
                        <span className="text-[11px] tracking-[0.06em] uppercase block mb-1" style={{ color: "var(--muted5)" }}>End</span>
                        <input type="date" value={goalFormData.endDate} min={goalFormData.startDate || undefined}
                          onChange={(e) => setGoalFormData((p) => ({ ...p, endDate: e.target.value }))}
                          className="w-full text-[13px] rounded-[10px] outline-none" style={{ padding: "9px 12px", background: "var(--field)", border: "1px solid var(--field-bd)", color: "var(--ink)" }} />
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[30, 60, 90].map((d) => (
                        <button key={d} type="button" onClick={() => applyCustomPreset(d)}
                          className="text-[11.5px] rounded-[8px]" style={{ padding: "5px 11px", color: "var(--accent)", background: "var(--chip)" }}>{d} days</button>
                      ))}
                    </div>
                    {!customRangeValid && (goalFormData.startDate || goalFormData.endDate) && (
                      <div className="text-[11.5px] mt-1.5" style={{ color: "var(--tag-fg)" }}>Pick a start and end date; end can&apos;t be before start.</div>
                    )}
                  </div>
                )}
                {canLinkParent && parentGoalOptions.length > 0 && (
                  <select value={goalFormData.parentGoalId} onChange={(e) => setGoalFormData((p) => ({ ...p, parentGoalId: e.target.value }))}
                    className="w-full text-[13.5px] rounded-[10px] outline-none mb-3" style={{ padding: "10px 14px", background: "var(--field)", border: "1px solid var(--field-bd)", color: "var(--ink)" }}>
                    <option value="">{parentLinkPlaceholder}</option>
                    {parentGoalOptions.map((g) => <option key={g._id} value={g._id}>{g.title}</option>)}
                  </select>
                )}
                <div className="flex gap-2.5">
                  <button onClick={editingGoal ? handleUpdateGoal : handleAddGoal} disabled={!goalFormData.title.trim() || !customRangeValid || goalsLoading}
                    className="cta text-[13px] font-semibold rounded-[10px] disabled:opacity-50" style={{ padding: "9px 20px", color: "var(--btn-fg)", background: "var(--btn-primary)" }}>{goalsLoading ? "Saving…" : editingGoal ? "Update" : "Add goal"}</button>
                  <button onClick={resetGoalForm} className="text-[13px]" style={{ padding: "9px 16px", color: "var(--accent)" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { resetGoalForm(); setShowGoalForm(true); }} className="hovrow w-full text-[13px] text-center rounded-[11px]" style={{ padding: "11px", border: "1px dashed var(--check-bd)", color: "var(--muted5)" }}>+ Add a goal</button>
            )}
          </div>
        </div>
      )}

      {/* Payments drawer */}
      {paymentsDrawerOpen && paymentsData?.configured && (
        <div className="fixed top-0 right-0 bottom-0 z-[61] w-[460px] max-w-[94vw] overflow-y-auto"
          style={{ background: "var(--drawer)", borderLeft: "1px solid var(--drawer-bd)", boxShadow: "-24px 0 60px -30px rgba(70,55,30,0.4)", animation: "drawerIn .28s cubic-bezier(.16,1,.3,1)" }}>
          <div className="flex items-start justify-between" style={{ padding: "24px 26px 0" }}>
            <div>
              <div style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[24px]">Payments due</div>
              <div className="text-[13px] mt-0.5" style={{ color: "var(--muted)" }}>{format(new Date(), "EEEE, MMMM d")}</div>
            </div>
            <button onClick={() => setPaymentsDrawerOpen(false)} className="p-1 text-[20px]" style={{ color: "var(--muted)" }}>✕</button>
          </div>
          <div style={{ padding: "18px 22px 26px" }} className="flex flex-col gap-2">
            {[...(paymentsData.accounts ?? []).map((a) => ({ id: a.id, name: a.shortName, total: a.total, items: a.items })),
              ...((paymentsData.budgets ?? []).length > 0 ? [{ id: "budgets", name: "Other payments", total: (paymentsData.budgets ?? []).reduce((s, b) => s + b.amount, 0), items: paymentsData.budgets ?? [] }] : [])
            ].map((row) => {
              const isPaid = paidPaymentAccounts.has(row.id);
              const isExpanded = expandedPaymentAccounts.has(row.id);
              return (
                <div key={row.id} className="rounded-[11px]" style={{ background: "var(--field)", border: "1px solid var(--field-bd)" }}>
                  <div className="flex items-center gap-3" style={{ padding: "12px 14px" }}>
                    <span className={cn("qcheck", isPaid && "checked")} onClick={() => togglePaymentAccountPaid(row.id)} />
                    <button className="flex-1 text-left" onClick={() => togglePaymentAccountExpanded(row.id)}>
                      <div className="text-[14px]" style={{ color: "var(--ink)", textDecoration: isPaid ? "line-through" : undefined }}>{row.name}</div>
                      <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{row.items.length} item{row.items.length === 1 ? "" : "s"}</div>
                    </button>
                    <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{fmtMoney(row.total)}</span>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: "0 14px 12px 40px" }} className="flex flex-col gap-1.5">
                      {row.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[12.5px]">
                          <span style={{ color: "var(--ink3)" }}>{it.label}</span>
                          <span style={{ color: "var(--muted)" }}>{fmtMoney(it.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between mt-2 pt-3 text-[13px]" style={{ borderTop: "1px solid var(--line2)" }}>
              <span style={{ color: "var(--muted)" }}>Income</span>
              <span style={{ color: "var(--ink3)" }}>{fmtMoney(paymentsData.totalIncome ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span style={{ color: "var(--muted)" }}>Day ends</span>
              <span className="font-semibold" style={{ color: (paymentsData.finalBalance ?? 0) >= 0 ? "#16a34a" : "var(--tag-fg)" }}>{(paymentsData.finalBalance ?? 0) >= 0 ? "+" : "−"}{fmtMoney(paymentsData.finalBalance ?? 0)}</span>
            </div>
          </div>
        </div>
      )}
      {/* Search command palette */}
      {searchOpen && (
        <>
          <div onClick={() => setSearchOpen(false)} className="fixed inset-0 z-[70]" style={{ background: "var(--overlay)", animation: "fadeIn .15s ease" }} />
          <div className="fixed left-1/2 -translate-x-1/2 top-[12vh] z-[71] w-[580px] max-w-[92vw] rounded-[16px] overflow-hidden"
            style={{ background: "var(--drawer)", border: "1px solid var(--drawer-bd)", boxShadow: "0 30px 70px -30px rgba(70,55,30,0.5)" }}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--line2)" }}>
              <Search className="w-4 h-4" style={{ color: "var(--muted)" }} />
              <input
                autoFocus
                type="text"
                placeholder="Search tasks and routines…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}
                className="flex-1 bg-transparent outline-none text-[15px]"
                style={{ color: "var(--ink)" }}
              />
              <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "var(--chip)", color: "var(--muted)" }}>esc</span>
            </div>
            <div className="max-h-[52vh] overflow-y-auto py-2">
              {(() => {
                const q = searchQuery.trim().toLowerCase();
                const matchTasks = q
                  ? tasks.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
                  : [];
                const matchRoutine = q ? checklistItems.filter(i => i.title.toLowerCase().includes(q)) : [];
                if (!q) {
                  return <div className="px-4 py-6 text-[13px] text-center" style={{ color: "var(--muted)" }}>Start typing to find a task or routine item.</div>;
                }
                if (matchTasks.length === 0 && matchRoutine.length === 0) {
                  return <div className="px-4 py-6 text-[13px] text-center" style={{ color: "var(--muted)" }}>No matches for &ldquo;{searchQuery}&rdquo;.</div>;
                }
                return (
                  <>
                    {MATRIX_ORDER.map((quadrant) => {
                      const rows = matchTasks.filter(t => t.quadrant === quadrant);
                      if (rows.length === 0) return null;
                      const meta = MATRIX_META[quadrant];
                      return (
                        <div key={quadrant} className="mb-1">
                          <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--muted2)" }}>{meta.name} · {rows.length}</div>
                          {rows.map((t) => (
                            <button key={t._id}
                              onClick={() => { setSearchOpen(false); void openTaskForEdit(t); }}
                              className="hovrow w-full flex items-center gap-3 px-4 py-2 text-left">
                              <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: meta.color }} />
                              <span className="flex-1 text-[14px] truncate" style={{ color: t.status === "completed" ? "var(--strike)" : "var(--ink2)", textDecoration: t.status === "completed" ? "line-through" : undefined }}>{t.title}</span>
                              {isTaskOverdue(t) && <span className="text-[10px] px-[7px] py-px rounded-[5px]" style={{ color: "var(--tag-fg)", background: "var(--tag-bg)" }}>Overdue</span>}
                              {t.dueDate && !isTaskOverdue(t) && <span className="text-[11px]" style={{ color: "var(--muted)" }}>{format(new Date(t.dueDate), "MMM d")}</span>}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                    {matchRoutine.length > 0 && (
                      <div className="mb-1">
                        <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--muted2)" }}>Routine · {matchRoutine.length}</div>
                        {matchRoutine.map((i) => (
                          <button key={i._id}
                            onClick={() => { setSearchOpen(false); setRoutineDrawerOpen(true); }}
                            className="hovrow w-full flex items-center gap-3 px-4 py-2 text-left">
                            <Repeat className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted)" }} />
                            <span className="flex-1 text-[14px] truncate" style={{ color: "var(--ink2)" }}>{i.title}</span>
                            <span className="text-[11px]" style={{ color: "var(--muted)" }}>{i.frequency}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-4 px-4 py-2 text-[11px]" style={{ borderTop: "1px solid var(--line2)", color: "var(--muted)" }}>
              <span>↵ open</span><span>esc close</span>
            </div>
          </div>
        </>
      )}

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
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
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
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
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
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
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
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
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
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
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
                        "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
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
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
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
                  "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
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
                              "flex-1 text-sm px-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
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
                      "flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--pill-active)]",
                      isDarkMode ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                    )}
                  />
                  <button
                    onClick={() => void handleAddSubtask()}
                    disabled={!newSubtaskTitle.trim()}
                    className="px-3 py-2 bg-[var(--btn-primary)] text-[var(--btn-fg)] rounded-lg text-sm hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex-1 px-4 py-2 bg-[var(--btn-primary)] text-[var(--btn-fg)] rounded-lg font-medium hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: "var(--overlay)" }} />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-[18px]"
            style={{ background: "var(--drawer)", border: "1px solid var(--drawer-bd)", boxShadow: "0 30px 70px -30px rgba(70,55,30,0.5)", padding: "26px 28px", color: "var(--ink)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[24px]">Settings</Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1 text-[20px]" style={{ color: "var(--muted)" }}>✕</button>
              </Dialog.Close>
            </div>

            <Dialog.Description className="sr-only">Application settings</Dialog.Description>

            <div className="flex flex-col">
              {/* Weather location */}
              <div className="pb-5">
                <label className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--ink2)" }}>Weather location</label>
                <p className="text-[12px] mb-2" style={{ color: "var(--muted)" }}>Drives the weather and what-to-wear line in your greeting.</p>
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="Montreal, Quebec"
                  className="w-full text-[13.5px] rounded-[10px] outline-none"
                  style={{ padding: "10px 14px", background: "var(--field)", border: "1px solid var(--field-bd)", color: "var(--ink)" }}
                />
              </div>

              <div style={{ borderTop: "1px solid var(--line2)" }} />

              {/* Gemini API Key */}
              <div className="py-5">
                <label className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--ink2)" }}>Google Gemini API key</label>
                <p className="text-[12px] mb-2" style={{ color: "var(--muted)" }}>
                  Used for AI what-to-wear suggestions. Get a free key at{" "}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }} className="hover:underline">aistudio.google.com</a>
                </p>
                <input
                  type="password"
                  value={settingsKeyInput}
                  onChange={(e) => setSettingsKeyInput(e.target.value)}
                  placeholder="AIza..."
                  className="w-full text-[13.5px] rounded-[10px] outline-none"
                  style={{ padding: "10px 14px", background: "var(--field)", border: "1px solid var(--field-bd)", color: "var(--ink)" }}
                />
                {settingsKeyInput && (
                  <button
                    onClick={() => setSettingsKeyInput("")}
                    className="text-[12px] font-medium mt-2"
                    style={{ color: "var(--tag-fg)" }}
                  >
                    Remove key
                  </button>
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--line2)" }} />

              {/* iCal Calendar Feeds */}
              <div className="pt-5">
                <label className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--ink2)" }}>Calendar feeds (iCal)</label>
                <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
                  Add .ics feed URLs from Google, Apple, or Outlook. Today&apos;s events appear next to your routine. For Google, use the <strong>Secret address in iCal format</strong> — not the public URL.
                </p>
                {draftIcalUrls.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-3">
                    {draftIcalUrls.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px] rounded-[10px]" style={{ padding: "9px 12px", background: "var(--tint)" }}>
                        <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted)" }} />
                        <span className="flex-1 truncate font-mono" style={{ color: "var(--ink3)" }}>{url}</span>
                        <button
                          onClick={() => setDraftIcalUrls(draftIcalUrls.filter((_, j) => j !== i))}
                          className="shrink-0 p-1 rounded" style={{ color: "var(--tag-fg)" }}
                          aria-label="Remove calendar feed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settingsIcalInput}
                      onChange={(e) => { setSettingsIcalInput(e.target.value); setSettingsIcalError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") addDraftIcalUrl(); }}
                      placeholder="https://calendar.google.com/...ical/..."
                      className="flex-1 text-[13.5px] rounded-[10px] outline-none"
                      style={{ padding: "10px 14px", background: "var(--field)", border: `1px solid ${settingsIcalError ? "var(--tag-fg)" : "var(--field-bd)"}`, color: "var(--ink)" }}
                    />
                    <button
                      onClick={addDraftIcalUrl}
                      disabled={!settingsIcalInput.trim()}
                      className="cta text-[13px] font-semibold rounded-[10px] disabled:opacity-40" style={{ padding: "9px 20px", color: "var(--btn-fg)", background: "var(--btn-primary)" }}
                    >
                      Add
                    </button>
                  </div>
                  {settingsIcalError && <p className="text-[12px]" style={{ color: "var(--tag-fg)" }}>{settingsIcalError}</p>}
                </div>
              </div>
            </div>

            {/* Footer: discard / apply all */}
            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4" style={{ borderTop: "1px solid var(--line2)" }}>
              <Dialog.Close asChild>
                <button className="text-[13px] font-medium rounded-[10px]" style={{ padding: "9px 18px", color: "var(--ink2)", background: "var(--chip)" }}>
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleSaveSettings}
                disabled={!settingsDirty}
                className="cta text-[13px] font-semibold rounded-[10px] disabled:opacity-40"
                style={{ padding: "9px 22px", color: "var(--btn-fg)", background: "var(--btn-primary)" }}
              >
                Save changes
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Eisenhower Matrix Info Modal */}
      {isInfoModalOpen && (
        <>
          <div onClick={() => setIsInfoModalOpen(false)} className="fixed inset-0 z-50" style={{ background: "var(--overlay)", animation: "fadeIn .2s ease" }} />
          <div className="fixed inset-0 z-[51] flex items-center justify-center p-4">
            <div className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-[18px]"
              style={{ background: "var(--drawer)", border: "1px solid var(--drawer-bd)", boxShadow: "0 30px 70px -30px rgba(70,55,30,0.5)", padding: "26px 28px", animation: "fadeIn .2s ease" }}>
              <div className="flex items-center justify-between mb-4">
                <div style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }} className="text-[24px]">The Eisenhower Matrix</div>
                <button onClick={() => setIsInfoModalOpen(false)} className="p-1 text-[20px]" style={{ color: "var(--muted)" }}>✕</button>
              </div>
              <p className="text-[14px] mb-5" style={{ color: "var(--ink4)" }}>
                Prioritize by urgency and importance — decide what to do first, what to schedule, what to hand off, and what to let go.
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { c: "var(--q-do-first)", t: "Urgent & Important — Do First", d: "Crises, deadlines, and problems that need action now. Handle these right away — they can't wait." },
                  { c: "var(--q-schedule)", t: "Important & Not Urgent — Schedule", d: "Crucial for long-term success but no pressing deadline. Give these dedicated time — often neglected, most valuable." },
                  { c: "var(--q-delegate)", t: "Urgent & Not Important — Delegate", d: "Demand attention but don't move your goals. Delegate when possible, or minimize the time you spend." },
                  { c: "var(--q-eliminate)", t: "Not Urgent & Not Important — Eliminate", d: "Time-wasters and busywork. Drop these or dramatically reduce them." },
                ].map((q) => (
                  <div key={q.t} className="rounded-[12px]" style={{ background: "var(--tint)", borderLeft: `3px solid ${q.c}`, padding: "14px 16px" }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-[9px] h-[9px] rounded-full" style={{ background: q.c }} />
                      <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{q.t}</span>
                    </div>
                    <p className="text-[13px]" style={{ color: "var(--ink4)" }}>{q.d}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-[12px] mt-4" style={{ background: "var(--chip)", padding: "14px 16px" }}>
                <p className="text-[13px]" style={{ color: "var(--ink4)" }}>
                  <strong style={{ color: "var(--ink2)" }}>Pro tip:</strong> Spend most of your energy in <em>Schedule</em>. Those tasks drive long-term success and prevent crises before they start.
                </p>
              </div>
              <div className="mt-5 flex justify-end">
                <button onClick={() => setIsInfoModalOpen(false)} className="cta text-[13px] font-semibold rounded-[10px]" style={{ padding: "9px 22px", color: "var(--btn-fg)", background: "var(--btn-primary)" }}>Got it</button>
              </div>
            </div>
          </div>
        </>
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
                    ? "text-[var(--accent)] hover:text-blue-300"
                    : "text-[var(--accent)] hover:brightness-95"
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