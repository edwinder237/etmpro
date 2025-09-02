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
  EyeOff
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import toast, { Toaster } from "react-hot-toast";
import { UserButton } from "@clerk/nextjs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { TaskIcon } from "~/components/icons/TaskIcon";

type TaskQuadrant = "urgent-important" | "important-not-urgent" | "urgent-not-important" | "not-urgent-not-important";
type TaskPriority = "high" | "medium" | "low";
type TaskStatus = "pending" | "in-progress" | "completed";

interface Task {
  _id: string;
  title: string;
  description?: string;
  quadrant: TaskQuadrant;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

const quadrantConfig = {
  "urgent-important": {
    title: "Urgent & Important",
    subtitle: "Do First",
    color: "bg-red-600",
    borderColor: "border-red-600",
    bgColor: "bg-red-600/10"
  },
  "important-not-urgent": {
    title: "Important & Not Urgent",
    subtitle: "Schedule",
    color: "bg-yellow-600",
    borderColor: "border-yellow-600",
    bgColor: "bg-yellow-600/10"
  },
  "urgent-not-important": {
    title: "Urgent & Not Important",
    subtitle: "Delegate",
    color: "bg-blue-600",
    borderColor: "border-blue-600",
    bgColor: "bg-blue-600/10"
  },
  "not-urgent-not-important": {
    title: "Not Urgent & Not Important",
    subtitle: "Eliminate",
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
  const [darkMode, setDarkMode] = useState(true);
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
  }>({
    title: "",
    description: "",
    quadrant: "urgent-important",
    priority: "medium",
    dueDate: ""
  });
  const [quickTaskInputs, setQuickTaskInputs] = useState<Record<TaskQuadrant, string>>({
    "urgent-important": "",
    "important-not-urgent": "",
    "urgent-not-important": "",
    "not-urgent-not-important": ""
  });

  useEffect(() => {
    void fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/tasks");
      if (response.ok) {
        const data = await response.json() as Task[];
        setTasks(data);
      } else {
        toast.error("Failed to fetch tasks");
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Error loading tasks");
    }
  };

  const handleAddTask = async () => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        await fetchTasks();
        closeModal();
        toast.success("Task added successfully!");
      } else {
        toast.error("Failed to add task");
      }
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Error adding task");
    }
  };

  const handleQuickAddTask = async (quadrant: TaskQuadrant, title: string) => {
    if (!title.trim()) return;
    
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          quadrant,
          priority: "medium",
          status: "pending"
        })
      });
      
      if (response.ok) {
        await fetchTasks();
        setQuickTaskInputs(prev => ({ ...prev, [quadrant]: "" }));
        toast.success("Task added!");
      } else {
        toast.error("Failed to add task");
      }
    } catch (error) {
      console.error("Error adding quick task:", error);
      toast.error("Error adding task");
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;

    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: editingTask._id,
          title: formData.title,
          description: formData.description,
          quadrant: formData.quadrant,
          priority: formData.priority,
          dueDate: formData.dueDate
        })
      });
      
      if (response.ok) {
        await fetchTasks();
        closeModal();
        toast.success("Task updated successfully!");
      } else {
        toast.error("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Error updating task");
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const response = await fetch(`/api/tasks?id=${id}`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        await fetchTasks();
        toast.success("Task deleted successfully!");
      } else {
        toast.error("Failed to delete task");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Error deleting task");
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: task._id,
          status: task.status === "completed" ? "pending" : "completed",
          completedAt: task.status === "completed" ? null : new Date()
        })
      });
      
      if (response.ok) {
        await fetchTasks();
        if (task.status === "completed") {
          toast.success("Task marked as pending");
        } else {
          toast.success("Task completed! 🎉");
        }
      } else {
        toast.error("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Error updating task");
    }
  };

  const handleMoveTask = async (task: Task, newQuadrant: TaskQuadrant) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: task._id,
          quadrant: newQuadrant
        })
      });
      
      if (response.ok) {
        await fetchTasks();
        const quadrantName = quadrantConfig[newQuadrant].title;
        toast.success(`Task moved to ${quadrantName}`);
      } else {
        toast.error("Failed to move task");
      }
    } catch (error) {
      console.error("Error moving task:", error);
      toast.error("Error moving task");
    }
  };

  const resetFormState = () => {
    setFormData({
      title: "",
      description: "",
      quadrant: "urgent-important",
      priority: "medium",
      dueDate: ""
    });
    setEditingTask(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetFormState();
  };

  const openModalForQuadrant = (quadrant: TaskQuadrant) => {
    setEditingTask(null);
    setFormData({
      title: "",
      description: "",
      quadrant,
      priority: "medium",
      dueDate: ""
    });
    setIsModalOpen(true);
  };

  const openTaskForEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description ?? "",
      quadrant: task.quadrant,
      priority: task.priority,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0]! : ""
    });
    setIsModalOpen(true);
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

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === "completed").length,
    highPriority: tasks.filter(t => t.priority === "high").length,
    thisWeek: tasks.filter(t => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      const today = new Date();
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      return dueDate >= today && dueDate <= weekFromNow;
    }).length
  };

  return (
    <div className={cn("min-h-screen", darkMode ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900")}>
      {/* Header */}
      <header className={cn("border-b", darkMode ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white")}>
        <div className="px-4 md:px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <TaskIcon className="w-5 h-5 text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold">ETM</h1>
                <p className={cn("text-sm hidden sm:block", darkMode ? "text-gray-400" : "text-gray-600")}>
                  Effective Time Management
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <div className="relative flex-1 md:flex-none">
                <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", 
                  darkMode ? "text-gray-400" : "text-gray-600")} />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "pl-10 pr-4 py-2 rounded-lg w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500",
                    darkMode ? "bg-gray-800 text-white placeholder-gray-500" : "bg-gray-100 text-gray-900 placeholder-gray-400"
                  )}
                />
              </div>
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={cn("p-2 rounded-lg", darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <button className={cn("p-2 rounded-lg hidden sm:block", darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className={cn("p-3 md:p-4 rounded-lg", darkMode ? "bg-gray-900" : "bg-white border border-gray-200")}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-xs md:text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>Total Tasks</p>
                <p className="text-xl md:text-2xl font-bold mt-1">{stats.total}</p>
              </div>
              <TaskIcon className="w-6 h-6 md:w-8 md:h-8 text-blue-500" size={24} />
            </div>
          </div>

          <div className={cn("p-3 md:p-4 rounded-lg", darkMode ? "bg-gray-900" : "bg-white border border-gray-200")}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-xs md:text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>Completed</p>
                <p className="text-xl md:text-2xl font-bold mt-1">{stats.completed}</p>
              </div>
              <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
            </div>
          </div>

          <div className={cn("p-3 md:p-4 rounded-lg", darkMode ? "bg-gray-900" : "bg-white border border-gray-200")}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-xs md:text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>High Priority</p>
                <p className="text-xl md:text-2xl font-bold mt-1">{stats.highPriority}</p>
              </div>
              <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-red-500" />
            </div>
          </div>

          <div className={cn("p-3 md:p-4 rounded-lg", darkMode ? "bg-gray-900" : "bg-white border border-gray-200")}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-xs md:text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>This Week</p>
                <p className="text-xl md:text-2xl font-bold mt-1">{stats.thisWeek}</p>
              </div>
              <Calendar className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Eisenhower Matrix */}
      <div className="px-4 md:px-6 pb-4 md:pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {(Object.keys(quadrantConfig) as TaskQuadrant[]).map((quadrant) => {
            const config = quadrantConfig[quadrant];
            const quadrantTasks = getTasksByQuadrant(quadrant);
            
            return (
              <div
                key={quadrant}
                className={cn(
                  "rounded-lg p-3 md:p-4 min-h-[250px] md:min-h-[300px]",
                  darkMode ? "bg-gray-900" : "bg-white border border-gray-200"
                )}
              >
                <div className={cn("flex items-center justify-between mb-3 md:mb-4 p-2 md:p-3 rounded-lg", config.bgColor)}>
                  <div>
                    <h3 className="font-semibold text-base md:text-lg">{config.title}</h3>
                    <p className={cn("text-xs md:text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>
                      {config.subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2">
                    <button
                      onClick={() => toggleCompletedVisibility(quadrant)}
                      className={cn(
                        "p-1 md:p-1.5 rounded-lg transition-colors",
                        darkMode ? "hover:bg-black/20 text-gray-400 hover:text-gray-200" : "hover:bg-white/30 text-gray-600 hover:text-gray-800"
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
                  {quadrantTasks.length === 0 ? (
                    <div className="text-center py-8">
                      <button
                        onClick={() => openModalForQuadrant(quadrant)}
                        className={cn(
                          "p-3 rounded-full mx-auto mb-3",
                          darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"
                        )}
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                      <p className={cn("text-sm", darkMode ? "text-gray-500" : "text-gray-400")}>
                        No tasks in this quadrant
                      </p>
                      <p className={cn("text-xs mt-1", darkMode ? "text-gray-600" : "text-gray-500")}>
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
                              className={cn(
                                "mt-0.5 rounded-full",
                                task.status === "completed" 
                                  ? "text-green-500" 
                                  : darkMode ? "text-gray-400" : "text-gray-500"
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
                                  darkMode ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {task.description}
                                </p>
                              )}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                                <span className={cn(
                                  "text-xs px-2 py-1 rounded w-fit",
                                  task.priority === "high" 
                                    ? "bg-red-500/20 text-red-400"
                                    : task.priority === "medium"
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : "bg-green-500/20 text-green-400"
                                )}>
                                  {task.priority} Priority
                                </span>
                                {task.dueDate && (
                                  <span className={cn("text-xs", darkMode ? "text-gray-500" : "text-gray-400")}>
                                    {format(new Date(task.dueDate), "MMM dd")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteTask(task._id)}
                              className={cn(
                                "p-1 md:p-1.5 rounded hover:bg-red-500/20 text-red-400",
                                darkMode ? "hover:bg-red-500/20" : "hover:bg-red-50"
                              )}
                            >
                              <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                            </button>
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger asChild>
                                <button className={cn(
                                  "p-1 md:p-1.5 rounded",
                                  darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
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
                                    darkMode ? "text-gray-400" : "text-gray-500"
                                  )}>
                                    Move to
                                  </DropdownMenu.Label>
                                  <DropdownMenu.Separator className={cn(
                                    "my-1 h-px",
                                    darkMode ? "bg-gray-700" : "bg-gray-200"
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
                      darkMode ? "text-gray-500" : "text-gray-400"
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
                      className={cn(
                        "w-full pl-10 pr-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
                        darkMode 
                          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 hover:border-gray-600" 
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 hover:border-gray-400"
                      )}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => openModalForQuadrant("urgent-important")}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 p-3 md:p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={cn(
            "w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto rounded-lg p-4 md:p-6",
            darkMode ? "bg-gray-900" : "bg-white"
          )}>
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-semibold">
                {editingTask ? "Edit Task" : "Add New Task"}
              </h2>
              <button
                onClick={closeModal}
                className={cn(
                  "p-1.5 md:p-2 rounded-lg",
                  darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
                )}
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            <div className="space-y-3 md:space-y-4">
              <div>
                <label className={cn("block text-sm font-medium mb-2", 
                  darkMode ? "text-gray-300" : "text-gray-700")}>
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
                  darkMode ? "text-gray-300" : "text-gray-700")}>
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
                  darkMode ? "text-gray-300" : "text-gray-700")}>
                  Quadrant
                </label>
                <select
                  value={formData.quadrant}
                  onChange={(e) => setFormData(prev => ({ ...prev, quadrant: e.target.value as TaskQuadrant }))}
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

              <div>
                <label className={cn("block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700")}>
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

              <div>
                <label className={cn("block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700")}>
                  Due Date
                </label>
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
              </div>
            </div>

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
                disabled={!formData.title}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingTask ? "Update Task" : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: darkMode ? '#1f2937' : '#fff',
            color: darkMode ? '#fff' : '#111827',
            border: darkMode ? '1px solid #374151' : '1px solid #e5e7eb',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: darkMode ? '#1f2937' : '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: darkMode ? '#1f2937' : '#fff',
            },
          },
        }}
      />
    </div>
  );
}