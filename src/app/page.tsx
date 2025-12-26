"use client";

import { useState, useEffect } from "react";
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
  Edit3
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
  addDays,
  subDays,
  isToday
} from "date-fns";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import { addToCalendar } from "~/lib/calendar-export";
import toast, { Toaster } from "react-hot-toast";
import { UserButton } from "@clerk/nextjs";
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
  subtaskCount?: number;
  subtaskCompletedCount?: number;
}

interface RoutineTask {
  _id: string;
  title: string;
  description?: string;
  quadrant: TaskQuadrant;
  priority: TaskPriority;
  duration?: number;
  usageCount?: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

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

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  // Use dark mode as default during SSR/initial render to prevent flash
  const isDarkMode = darkMode ?? true;
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
  }>({
    title: "",
    description: "",
    quadrant: "urgent-important",
    priority: "medium",
    dueDate: "",
    dueTime: "12:00",
    duration: ""
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
  });

  // Stats drawer state
  type StatType = "total" | "completed" | "highPriority" | "thisWeek" | null;
  const [statsDrawerType, setStatsDrawerType] = useState<StatType>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Routine tasks state
  const [routineTasks, setRoutineTasks] = useState<RoutineTask[]>([]);
  const [isRoutineDrawerOpen, setIsRoutineDrawerOpen] = useState(false);
  const [editingRoutineTask, setEditingRoutineTask] = useState<RoutineTask | null>(null);
  const [routineTaskLoading, setRoutineTaskLoading] = useState(false);
  const [routineFormData, setRoutineFormData] = useState({
    title: "",
    description: "",
    quadrant: "urgent-important" as TaskQuadrant,
    priority: "medium" as TaskPriority,
    duration: "" as number | "",
  });

  // Subtask state (for edit modal)
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [subtasksLoading, setSubtasksLoading] = useState(false);

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

  // Helper functions for calendar
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return isSameDay(taskDate, date);
    });
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
    void fetchRoutineTasks();
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

  // Lock body scroll when any modal/drawer is open
  useEffect(() => {
    const isAnyModalOpen = isModalOpen || isInfoModalOpen || isCalendarDrawerOpen || isCalendarTaskModalOpen || statsDrawerType !== null || isRoutineDrawerOpen;

    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, isInfoModalOpen, isCalendarDrawerOpen, isCalendarTaskModalOpen, statsDrawerType, isRoutineDrawerOpen]);

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

  const fetchRoutineTasks = async () => {
    try {
      const response = await fetch("/api/routine-tasks");
      if (response.ok) {
        const data = await response.json() as RoutineTask[];
        setRoutineTasks(data);
      }
    } catch {
      // Silently fail - routine tasks are optional
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
          duration: formData.duration || undefined
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
          duration: formData.duration || null
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

  // Routine task handlers
  const handleAddRoutineTask = async () => {
    if (!routineFormData.title.trim()) return;

    try {
      setRoutineTaskLoading(true);
      const response = await fetch("/api/routine-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: routineFormData.title,
          description: routineFormData.description,
          quadrant: routineFormData.quadrant,
          priority: routineFormData.priority,
          duration: routineFormData.duration || undefined
        })
      });

      if (response.ok) {
        const newRoutineTask = await response.json() as RoutineTask;
        setRoutineTasks(prev => [newRoutineTask, ...prev]);
        resetRoutineFormState();
        toast.success("Routine task created!");
      } else {
        toast.error("Failed to create routine task");
      }
    } catch {
      toast.error("Error creating routine task");
    } finally {
      setRoutineTaskLoading(false);
    }
  };

  const handleUpdateRoutineTask = async () => {
    if (!editingRoutineTask || !routineFormData.title.trim()) return;

    try {
      setRoutineTaskLoading(true);
      const response = await fetch("/api/routine-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: editingRoutineTask._id,
          title: routineFormData.title,
          description: routineFormData.description,
          quadrant: routineFormData.quadrant,
          priority: routineFormData.priority,
          duration: routineFormData.duration || null
        })
      });

      if (response.ok) {
        const updatedRoutineTask = await response.json() as RoutineTask;
        setRoutineTasks(prev => prev.map(rt =>
          rt._id === updatedRoutineTask._id ? updatedRoutineTask : rt
        ));
        resetRoutineFormState();
        toast.success("Routine task updated!");
      } else {
        toast.error("Failed to update routine task");
      }
    } catch {
      toast.error("Error updating routine task");
    } finally {
      setRoutineTaskLoading(false);
    }
  };

  const handleDeleteRoutineTask = async (id: string) => {
    try {
      setRoutineTaskLoading(true);
      const response = await fetch(`/api/routine-tasks?id=${id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setRoutineTasks(prev => prev.filter(rt => rt._id !== id));
        toast.success("Routine task deleted!");
      } else {
        toast.error("Failed to delete routine task");
      }
    } catch {
      toast.error("Error deleting routine task");
    } finally {
      setRoutineTaskLoading(false);
    }
  };

  const incrementRoutineTaskUsage = async (id: string) => {
    try {
      await fetch(`/api/routine-tasks?id=${id}`, {
        method: "PATCH"
      });
      // Update local state
      setRoutineTasks(prev => prev.map(rt =>
        rt._id === id
          ? { ...rt, usageCount: (rt.usageCount ?? 0) + 1, lastUsedAt: new Date().toISOString() }
          : rt
      ));
    } catch {
      // Silently fail - usage tracking is not critical
    }
  };

  const resetRoutineFormState = () => {
    setRoutineFormData({
      title: "",
      description: "",
      quadrant: "urgent-important",
      priority: "medium",
      duration: ""
    });
    setEditingRoutineTask(null);
  };

  const openRoutineTaskForEdit = (routineTask: RoutineTask) => {
    setEditingRoutineTask(routineTask);
    setRoutineFormData({
      title: routineTask.title,
      description: routineTask.description ?? "",
      quadrant: routineTask.quadrant,
      priority: routineTask.priority,
      duration: routineTask.duration ?? ""
    });
  };

  const applyRoutineTaskToForm = (routineTask: RoutineTask) => {
    setFormData(prev => ({
      ...prev,
      title: routineTask.title,
      description: routineTask.description ?? "",
      quadrant: routineTask.quadrant,
      priority: routineTask.priority,
      duration: routineTask.duration ?? ""
    }));
    void incrementRoutineTaskUsage(routineTask._id);
  };

  const resetFormState = () => {
    setFormData({
      title: "",
      description: "",
      quadrant: "urgent-important",
      priority: "medium",
      dueDate: "",
      dueTime: "12:00",
      duration: ""
    });
    setEditingTask(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetFormState();
    setSubtasks([]);
    setNewSubtaskTitle("");
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
      duration: ""
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
      duration: task.duration ?? ""
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

  return (
    <div className={cn("min-h-screen", isDarkMode ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900")}>
      {/* Header */}
      <header className={cn(
        "border-b sticky top-0 z-30 backdrop-blur-md",
        isDarkMode ? "border-gray-800/50 bg-gray-900/80" : "border-gray-200/50 bg-white/80"
      )}>
        <div className="px-4 md:px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <EisenqLogo size={36} />
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-bold">EisenQ</h1>
                <span className={cn("text-sm hidden sm:block", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                  Decide & Do
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <div className="relative flex-1 md:flex-none">
                <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", 
                  isDarkMode ? "text-gray-400" : "text-gray-600")} />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "pl-10 pr-4 py-2 rounded-lg w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500",
                    isDarkMode ? "bg-gray-800 text-white placeholder-gray-500" : "bg-gray-100 text-gray-900 placeholder-gray-400"
                  )}
                />
              </div>
              
              <button
                onClick={() => setIsCalendarDrawerOpen(true)}
                className={cn("p-2 rounded-lg", isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
                title="Task Planning Calendar"
              >
                <CalendarDays className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsRoutineDrawerOpen(true)}
                className={cn("p-2 rounded-lg", isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
                title="Routine Tasks"
              >
                <Repeat className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsInfoModalOpen(true)}
                className={cn("p-2 rounded-lg", isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
                title="How the Eisenhower Matrix works"
              >
                <Info className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  const newValue = !isDarkMode;
                  setDarkMode(newValue);
                  localStorage.setItem("eisenq-dark-mode", String(newValue));
                }}
                className={cn("p-2 rounded-lg", isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button className={cn("p-2 rounded-lg hidden sm:block", isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}>
                <Settings className="w-5 h-5" />
              </button>
              
              <UserButton 
                afterSignOutUrl="/sign-in"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 md:w-10 md:h-10",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="px-4 md:px-6 py-4 md:py-6">
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="hidden md:block"><StatCardSkeleton darkMode={isDarkMode} /></div>
            <div className="hidden md:block"><StatCardSkeleton darkMode={isDarkMode} /></div>
            <StatCardSkeleton darkMode={isDarkMode} />
            <StatCardSkeleton darkMode={isDarkMode} />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Total Tasks - hidden on small screens */}
          <div className={cn("hidden md:block p-3 md:p-4 rounded-lg", isDarkMode ? "bg-gray-900" : "bg-white border border-gray-200")}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-xs md:text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>Total Tasks</p>
                <button
                  onClick={() => setStatsDrawerType("total")}
                  className="text-xl md:text-2xl font-bold mt-1 hover:text-blue-500 transition-colors cursor-pointer"
                >
                  {stats.total}
                </button>
              </div>
              <TaskIcon className="w-6 h-6 md:w-8 md:h-8 text-blue-500" size={24} />
            </div>
          </div>

          {/* Completed - hidden on small screens */}
          <div className={cn("hidden md:block p-3 md:p-4 rounded-lg", isDarkMode ? "bg-gray-900" : "bg-white border border-gray-200")}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-xs md:text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>Completed</p>
                <button
                  onClick={() => setStatsDrawerType("completed")}
                  className="text-xl md:text-2xl font-bold mt-1 hover:text-green-500 transition-colors cursor-pointer"
                >
                  {stats.completed}
                </button>
              </div>
              <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
            </div>
          </div>

          {/* High Priority - always visible */}
          <div className={cn("p-3 md:p-4 rounded-lg", isDarkMode ? "bg-gray-900" : "bg-white border border-gray-200")}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-xs md:text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>High Priority</p>
                <button
                  onClick={() => setStatsDrawerType("highPriority")}
                  className="text-xl md:text-2xl font-bold mt-1 hover:text-red-500 transition-colors cursor-pointer"
                >
                  {stats.highPriority}
                </button>
              </div>
              <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-red-500" />
            </div>
          </div>

          {/* This Week - always visible */}
          <div className={cn("p-3 md:p-4 rounded-lg", isDarkMode ? "bg-gray-900" : "bg-white border border-gray-200")}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-xs md:text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>This Week</p>
                <button
                  onClick={() => setStatsDrawerType("thisWeek")}
                  className="text-xl md:text-2xl font-bold mt-1 hover:text-blue-500 transition-colors cursor-pointer"
                >
                  {stats.thisWeek}
                </button>
              </div>
              <Calendar className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
          </div>
        </div>
        )}
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
                                openTaskForEdit(task);
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
                    <h3 className="font-semibold text-lg">
                      {calendarView === "day" && format(selectedDate, "EEEE, MMMM d, yyyy")}
                      {calendarView === "week" && `${format(startOfWeek(selectedDate), "MMM d")} - ${format(endOfWeek(selectedDate), "MMM d, yyyy")}`}
                      {calendarView === "month" && format(selectedDate, "MMMM yyyy")}
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
                {calendarView === "day" && (
                  <div className="space-y-3">
                    {getTasksForDate(selectedDate).length === 0 ? (
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
                      getTasksForDate(selectedDate).map((task) => (
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
                      ))
                    )}
                  </div>
                )}

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
                            {dayTasks.slice(0, 3).map((task) => (
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
                            {dayTasks.length > 3 && (
                              <div className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                                +{dayTasks.length - 3} more
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
                              {/* Dots indicator for additional tasks */}
                              {dayTasks.length > 2 && (
                                <div className="flex gap-0.5">
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
                    value={format(calendarTaskForm.date, "yyyy-MM-dd")}
                    onChange={(e) => {
                      // Parse date parts to avoid timezone shift issues
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      const newDate = new Date(year ?? 2025, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
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

      {/* Eisenhower Matrix */}
      <div className="px-4 md:px-6 pb-4 md:pb-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <QuadrantSkeleton key={i} darkMode={isDarkMode} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {(Object.keys(quadrantConfig) as TaskQuadrant[]).map((quadrant) => {
            const config = quadrantConfig[quadrant];
            const quadrantTasks = getTasksByQuadrant(quadrant);
            
            return (
              <div
                key={quadrant}
                className={cn(
                  "rounded-lg p-3 md:p-4 min-h-[250px] md:min-h-[300px]",
                  isDarkMode ? "bg-gray-900" : "bg-white border border-gray-200"
                )}
              >
                <div className={cn("flex items-center justify-between mb-3 md:mb-4 p-2 md:p-3 rounded-lg", config.bgColor)}>
                  <div>
                    <h3 className="font-semibold text-base md:text-lg">{config.title}</h3>
                    <p className={cn("text-xs md:text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                      {config.subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2">
                    <button
                      onClick={() => toggleCompletedVisibility(quadrant)}
                      className={cn(
                        "p-1 md:p-1.5 rounded-lg transition-colors",
                        isDarkMode ? "hover:bg-black/20 text-gray-400 hover:text-gray-200" : "hover:bg-white/30 text-gray-600 hover:text-gray-800"
                      )}
                      title={hideCompleted[quadrant] ? "Show completed tasks" : "Hide completed tasks"}
                    >
                      {hideCompleted[quadrant] ? (
                        <EyeOff className="w-3 h-3 md:w-4 md:h-4" />
                      ) : (
                        <Eye className="w-3 h-3 md:w-4 md:h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {quadrantLoading[quadrant] ? (
                    <>
                      {Array.from({ length: Math.max(3, quadrantTasks.length) }).map((_, i) => (
                        <TaskCardSkeleton key={i} darkMode={isDarkMode} />
                      ))}
                    </>
                  ) : quadrantTasks.length === 0 ? (
                    <div className="text-center py-8">
                      <button
                        onClick={() => openModalForQuadrant(quadrant)}
                        className={cn(
                          "p-3 rounded-full mx-auto mb-3",
                          isDarkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"
                        )}
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                      <p className={cn("text-sm", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                        No tasks in this quadrant
                      </p>
                      <p className={cn("text-xs mt-1", isDarkMode ? "text-gray-600" : "text-gray-500")}>
                        Click the + button to add one
                      </p>
                    </div>
                  ) : (
                    quadrantTasks.map((task) => (
                      <div
                        key={task._id}
                        className={cn(
                          "p-2 md:p-3 rounded-lg border transition-all",
                          darkMode 
                            ? "bg-gray-800 border-gray-700 hover:border-gray-600" 
                            : "bg-gray-50 border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2 md:gap-3 flex-1">
                            <button
                              onClick={() => handleToggleComplete(task)}
                              disabled={taskOperationLoading[`toggle-${task._id}`]}
                              className={cn(
                                "mt-0.5 rounded-full transition-opacity",
                                task.status === "completed" 
                                  ? "text-green-500" 
                                  : isDarkMode ? "text-gray-400" : "text-gray-500",
                                taskOperationLoading[`toggle-${task._id}`] && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {task.status === "completed" ? (
                                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                              ) : (
                                <div className="w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-current" />
                              )}
                            </button>
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => openTaskForEdit(task)}
                            >
                              <p className={cn(
                                "font-medium text-sm md:text-base",
                                task.status === "completed" && "line-through opacity-60"
                              )}>
                                {task.title}
                              </p>
                              {task.description && (
                                <p className={cn(
                                  "text-xs md:text-sm mt-1",
                                  isDarkMode ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {task.description}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                {(task.priority === "high" || task.quadrant === "urgent-important") && (
                                  <span className="text-xs px-2 py-1 rounded w-fit bg-red-500/20 text-red-400">
                                    High Priority
                                  </span>
                                )}
                                {task.dueDate ? (
                                  <span className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                                    {format(new Date(task.dueDate), "MMM dd")} • {format(new Date(task.dueDate), "HH:mm")}
                                  </span>
                                ) : task.quadrant === "important-not-urgent" ? (
                                  <button
                                    onClick={() => openTaskForEdit(task)}
                                    className={cn(
                                      "text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors",
                                      darkMode
                                        ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                                        : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    )}
                                  >
                                    <Calendar className="w-3 h-3" />
                                    Schedule
                                  </button>
                                ) : null}
                                {task.duration && (
                                  <span className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                                    {task.duration >= 60 ? `${Math.floor(task.duration / 60)}h${task.duration % 60 ? ` ${task.duration % 60}m` : ''}` : `${task.duration}m`}
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
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteTask(task._id)}
                              disabled={taskOperationLoading[`delete-${task._id}`]}
                              className={cn(
                                "p-1 md:p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-opacity",
                                isDarkMode ? "hover:bg-red-500/20" : "hover:bg-red-50",
                                taskOperationLoading[`delete-${task._id}`] && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                            </button>
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger asChild>
                                <button className={cn(
                                  "p-1 md:p-1.5 rounded",
                                  isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                                )}>
                                  <MoreVertical className="w-3 h-3 md:w-4 md:h-4" />
                                </button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                  className={cn(
                                    "min-w-[200px] rounded-lg p-1 shadow-lg z-50",
                                    darkMode 
                                      ? "bg-gray-800 border border-gray-700" 
                                      : "bg-white border border-gray-200"
                                  )}
                                  sideOffset={5}
                                >
                                  <DropdownMenu.Label className={cn(
                                    "px-2 py-1.5 text-xs font-semibold",
                                    isDarkMode ? "text-gray-400" : "text-gray-500"
                                  )}>
                                    Move to
                                  </DropdownMenu.Label>
                                  <DropdownMenu.Separator className={cn(
                                    "my-1 h-px",
                                    isDarkMode ? "bg-gray-700" : "bg-gray-200"
                                  )} />
                                  
                                  {(Object.keys(quadrantConfig) as TaskQuadrant[])
                                    .filter(q => q !== task.quadrant)
                                    .map((q) => {
                                      const config = quadrantConfig[q];
                                      return (
                                        <DropdownMenu.Item
                                          key={q}
                                          className={cn(
                                            "px-2 py-2 text-sm rounded cursor-pointer flex items-center gap-2",
                                            darkMode 
                                              ? "hover:bg-gray-700 text-gray-200" 
                                              : "hover:bg-gray-100 text-gray-700"
                                          )}
                                          onSelect={() => handleMoveTask(task, q)}
                                        >
                                          <div className={cn(
                                            "w-3 h-3 rounded-full",
                                            q === "urgent-important" ? "bg-red-500" :
                                            q === "important-not-urgent" ? "bg-yellow-500" :
                                            q === "urgent-not-important" ? "bg-blue-500" :
                                            "bg-green-500"
                                          )} />
                                          <span>{config.title}</span>
                                        </DropdownMenu.Item>
                                      );
                                    })}
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick Add Task Input */}
                <div className="mt-3">
                  <div className="relative">
                    <Plus className={cn(
                      "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                      isDarkMode ? "text-gray-500" : "text-gray-400"
                    )} />
                    <input
                      type="text"
                      placeholder={`Add a task to ${config.title}...`}
                      value={quickTaskInputs[quadrant]}
                      onChange={(e) => setQuickTaskInputs(prev => ({ ...prev, [quadrant]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void handleQuickAddTask(quadrant, quickTaskInputs[quadrant]);
                        }
                      }}
                      disabled={taskOperationLoading[`quickAdd-${quadrant}`]}
                      className={cn(
                        "w-full pl-10 pr-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
                        darkMode 
                          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 hover:border-gray-600" 
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 hover:border-gray-400",
                        taskOperationLoading[`quickAdd-${quadrant}`] && "opacity-50 cursor-not-allowed"
                      )}
                    />
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
        className="fixed bottom-20 right-4 md:bottom-24 md:right-6 p-3 md:p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-40"
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
                {/* Routine Task Suggestions */}
                {!editingTask && routineTasks.length > 0 && (
                  <div className="mt-2">
                    <p className={cn("text-xs mb-1.5", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                      From your routines:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {routineTasks
                        .filter(rt =>
                          !formData.title ||
                          rt.title.toLowerCase().includes(formData.title.toLowerCase())
                        )
                        .slice(0, 5)
                        .map((routine) => (
                          <button
                            key={routine._id}
                            type="button"
                            onClick={() => applyRoutineTaskToForm(routine)}
                            className={cn(
                              "px-2 py-1 text-xs rounded-md border transition-colors",
                              darkMode
                                ? "border-gray-700 hover:bg-gray-800 hover:border-gray-600"
                                : "border-gray-200 hover:bg-gray-50 hover:border-gray-300",
                              routine.quadrant === "urgent-important" && "text-red-400",
                              routine.quadrant === "important-not-urgent" && "text-yellow-400",
                              routine.quadrant === "urgent-not-important" && "text-blue-400",
                              routine.quadrant === "not-urgent-not-important" && "text-green-400"
                            )}
                          >
                            {routine.title}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cn("block text-sm font-medium mb-2",
                    isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Due Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
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
                  <div className="text-center py-4">
                    <span className={cn("text-sm", isDarkMode ? "text-gray-500" : "text-gray-400")}>Loading subtasks...</span>
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
                        <span className={cn(
                          "flex-1 text-sm",
                          subtask.status === "completed" && "line-through opacity-60"
                        )}>
                          {subtask.title}
                        </span>
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

      {/* Routine Tasks Drawer */}
      <Dialog.Root open={isRoutineDrawerOpen} onOpenChange={setIsRoutineDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content
            className={cn(
              "fixed right-0 top-0 h-full w-full max-w-md z-50 shadow-xl",
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
                    <Repeat className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-semibold">Routine Tasks</Dialog.Title>
                    <Dialog.Description className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                      Create templates for recurring tasks
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button className={cn("p-2 rounded-lg", isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}>
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Routine Task Form */}
              <div className={cn("p-4 border-b", isDarkMode ? "border-gray-800" : "border-gray-200")}>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Routine task title..."
                    value={routineFormData.title}
                    onChange={(e) => setRoutineFormData(prev => ({ ...prev, title: e.target.value }))}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                    )}
                  />
                  <textarea
                    placeholder="Description (optional)..."
                    value={routineFormData.description}
                    onChange={(e) => setRoutineFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none",
                      isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                    )}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={routineFormData.quadrant}
                      onChange={(e) => setRoutineFormData(prev => ({ ...prev, quadrant: e.target.value as TaskQuadrant }))}
                      className={cn(
                        "px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    >
                      <option value="urgent-important">Urgent & Important</option>
                      <option value="important-not-urgent">Important & Not Urgent</option>
                      <option value="urgent-not-important">Urgent & Not Important</option>
                      <option value="not-urgent-not-important">Not Urgent & Not Important</option>
                    </select>
                    <select
                      value={routineFormData.priority}
                      onChange={(e) => setRoutineFormData(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
                      className={cn(
                        "px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    >
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>
                  <select
                    value={routineFormData.duration}
                    onChange={(e) => setRoutineFormData(prev => ({ ...prev, duration: e.target.value ? Number(e.target.value) : "" }))}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                    )}
                  >
                    <option value="">No default duration</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                  <div className="flex gap-2">
                    {editingRoutineTask && (
                      <button
                        onClick={resetRoutineFormState}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg font-medium transition-colors",
                          isDarkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"
                        )}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={editingRoutineTask ? handleUpdateRoutineTask : handleAddRoutineTask}
                      disabled={!routineFormData.title.trim() || routineTaskLoading}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {routineTaskLoading ? "Saving..." : editingRoutineTask ? "Update" : "Add Routine"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Routine Tasks List */}
              <div className="flex-1 overflow-y-auto p-4">
                {routineTasks.length === 0 ? (
                  <div className={cn("text-center py-12", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                    <Repeat className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No routine tasks yet</p>
                    <p className="text-xs mt-1">Create templates for tasks you do regularly</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {routineTasks.map((routine) => (
                      <div
                        key={routine._id}
                        className={cn(
                          "p-3 rounded-lg border",
                          isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{routine.title}</h4>
                            {routine.description && (
                              <p className={cn("text-sm truncate mt-0.5", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                                {routine.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded",
                                routine.quadrant === "urgent-important" && "bg-red-500/20 text-red-400",
                                routine.quadrant === "important-not-urgent" && "bg-yellow-500/20 text-yellow-400",
                                routine.quadrant === "urgent-not-important" && "bg-blue-500/20 text-blue-400",
                                routine.quadrant === "not-urgent-not-important" && "bg-green-500/20 text-green-400"
                              )}>
                                {quadrantConfig[routine.quadrant].title}
                              </span>
                              {routine.usageCount !== undefined && routine.usageCount > 0 && (
                                <span className={cn("text-xs", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                                  Used {routine.usageCount}x
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openRoutineTaskForEdit(routine)}
                              className={cn("p-1.5 rounded", isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-200")}
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRoutineTask(routine._id)}
                              className={cn("p-1.5 rounded text-red-400", isDarkMode ? "hover:bg-red-500/20" : "hover:bg-red-50")}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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