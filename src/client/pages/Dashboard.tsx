import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Mic,
  Search,
  Calendar,
  ChevronRight,
  Loader2,
  FileText,
  Clock,
  User,
} from "lucide-react";
import { trpc } from "@/client/lib/trpc";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Badge } from "@/client/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { Card, CardContent } from "@/client/components/ui/card";

type MeetingStatus = "pending" | "processing" | "done" | "error";

function StatusBadge({ status }: { status: MeetingStatus }) {
  const variants: Record<
    MeetingStatus,
    { variant: "success" | "processing" | "warning" | "error"; label: string }
  > = {
    done: { variant: "success", label: "Done" },
    processing: { variant: "processing", label: "Processing" },
    pending: { variant: "warning", label: "Pending" },
    error: { variant: "error", label: "Error" },
  };
  const { variant, label } = variants[status] || {
    variant: "secondary" as const,
    label: status,
  };
  return <Badge variant={variant}>{label}</Badge>;
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");

  const { data: meetings, isLoading, error, refetch } = trpc.meetings.list.useQuery({
    search: appliedSearch || undefined,
    dateFrom: appliedDateFrom ? new Date(appliedDateFrom).toISOString() : undefined,
    dateTo: appliedDateTo ? new Date(appliedDateTo + "T23:59:59").toISOString() : undefined,
    limit: 50,
    offset: 0,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedSearch(search);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
  }

  function handleReset() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setAppliedSearch("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
  }

  const hasFilters = appliedSearch || appliedDateFrom || appliedDateTo;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meeting Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Browse and search all recorded meetings
          </p>
        </div>
        <Link to="/record">
          <Button className="gap-2 shrink-0">
            <Mic className="h-4 w-4" />
            New Recording
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search meetings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36"
                title="From date"
              />
              <span className="text-slate-400 text-sm">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36"
                title="To date"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
              {hasFilters && (
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-slate-600">Loading meetings...</span>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-600 mb-4">
            Failed to load meetings. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : meetings && meetings.length > 0 ? (
        <>
          <div className="hidden md:block">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Title</TableHead>
                    <TableHead>Recorded by</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings.map((meeting) => (
                    <TableRow key={meeting.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 line-clamp-1">
                              {meeting.title}
                            </p>
                            {meeting.summary && (
                              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                {meeting.summary}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          {meeting.recorderName ||
                            (meeting.user ? meeting.user.name : "Anonymous")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-slate-700">
                            {formatDate(meeting.createdAt)}
                          </div>
                          <div className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {formatTime(meeting.createdAt)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={meeting.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/meeting/${meeting.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            View
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {meetings.map((meeting) => (
              <Link key={meeting.id} to={`/meeting/${meeting.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {meeting.title}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          {meeting.recorderName ||
                            (meeting.user ? meeting.user.name : "Anonymous")}
                          {" · "}
                          {formatDate(meeting.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={meeting.status} />
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <p className="text-sm text-slate-500 mt-4 text-center">
            Showing {meetings.length} meeting{meetings.length !== 1 ? "s" : ""}
            {hasFilters && " matching your filters"}
          </p>
        </>
      ) : (
        <div className="text-center py-20">
          <div className="mx-auto h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {hasFilters ? "No meetings found" : "No meetings yet"}
          </h3>
          <p className="text-slate-500 mb-6">
            {hasFilters
              ? "Try adjusting your search or date filters."
              : "Start recording your first meeting to get started."}
          </p>
          {hasFilters ? (
            <Button variant="outline" onClick={handleReset}>
              Clear Filters
            </Button>
          ) : (
            <Link to="/record">
              <Button className="gap-2">
                <Mic className="h-4 w-4" />
                Record a Meeting
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
