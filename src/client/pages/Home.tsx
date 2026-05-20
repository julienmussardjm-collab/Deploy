import { Link } from "react-router-dom";
import {
  Mic,
  Zap,
  Archive,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";

const features = [
  {
    icon: Mic,
    title: "Easy Recording",
    description:
      "Record meetings directly in your browser with one click. No downloads, no software installs. Works on any device with a microphone.",
    color: "blue",
    benefits: [
      "Browser-based, no install needed",
      "Pause and resume anytime",
      "Real-time audio level display",
    ],
  },
  {
    icon: Zap,
    title: "Smart Processing",
    description:
      "Powered by OpenAI Whisper for accurate transcription and GPT-4 for intelligent summaries and key points extraction.",
    color: "purple",
    benefits: [
      "Whisper AI transcription",
      "GPT-4 meeting summaries",
      "Automatic key points",
    ],
  },
  {
    icon: Archive,
    title: "Organized Archive",
    description:
      "All your meetings in one place. Search by title, filter by date, and access full transcriptions, summaries and recordings anytime.",
    color: "green",
    benefits: [
      "Full-text search",
      "Date range filtering",
      "No login required",
    ],
  },
];

const colorMap: Record<
  string,
  { bg: string; icon: string; badge: string }
> = {
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-600",
    badge: "bg-blue-600",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-600",
    badge: "bg-purple-600",
  },
  green: {
    bg: "bg-green-50",
    icon: "text-green-600",
    badge: "bg-green-600",
  },
};

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Powered by OpenAI Whisper & GPT-4
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
              Record, Transcribe &{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Summarize
              </span>{" "}
              Meetings
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 mb-10 leading-relaxed">
              Capture every word of your meetings. Get instant AI-powered
              transcriptions, summaries, and key points — no login required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/record">
                <Button
                  size="xl"
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 gap-2 text-base"
                >
                  <Mic className="h-5 w-5" />
                  Start Recording Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button
                  size="xl"
                  variant="outline"
                  className="w-full sm:w-auto border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white gap-2 text-base"
                >
                  <Archive className="h-5 w-5" />
                  View Dashboard
                </Button>
              </Link>
            </div>

            <p className="mt-6 text-sm text-slate-500">
              No account needed &mdash; just start recording
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="bg-slate-800 border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: "Accuracy", value: "99%", sub: "Whisper AI" },
              { label: "Languages", value: "50+", sub: "Supported" },
              { label: "Processing", value: "<60s", sub: "Average" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-slate-400">
                  {stat.label} &middot; {stat.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="py-20 md:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Everything you need for meeting notes
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Stop taking notes during meetings. Let AI handle the hard work so
              you can focus on the conversation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => {
              const colors = colorMap[feature.color];
              return (
                <Card
                  key={feature.title}
                  className="border-slate-200 hover:shadow-md transition-shadow"
                >
                  <CardHeader>
                    <div
                      className={`h-12 w-12 rounded-xl ${colors.bg} flex items-center justify-center mb-2`}
                    >
                      <feature.icon className={`h-6 w-6 ${colors.icon}`} />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {feature.benefits.map((benefit) => (
                        <li
                          key={benefit}
                          className="flex items-center gap-2 text-sm text-slate-600"
                        >
                          <CheckCircle
                            className={`h-4 w-4 ${colors.icon} shrink-0`}
                          />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              How it works
            </h2>
            <p className="text-lg text-slate-600 max-w-xl mx-auto">
              From recording to AI insights in minutes
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                title: "Record",
                description: "Click record and capture your meeting audio directly in the browser.",
              },
              {
                step: "02",
                title: "Upload",
                description: "Your audio is securely uploaded to cloud storage.",
              },
              {
                step: "03",
                title: "Transcribe",
                description: "Whisper AI converts speech to text with high accuracy.",
              },
              {
                step: "04",
                title: "Summarize",
                description: "GPT-4 generates a summary and key action points.",
              },
            ].map((step, i) => (
              <div key={step.step} className="relative text-center">
                {i < 3 && (
                  <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-px bg-slate-200" />
                )}
                <div className="relative z-10 mx-auto h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm mb-4">
                  {step.step}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to capture your next meeting?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            No setup required. Start recording in seconds.
          </p>
          <Link to="/record">
            <Button
              size="xl"
              className="bg-white text-blue-600 hover:bg-blue-50 gap-2"
            >
              <Mic className="h-5 w-5" />
              Start Recording Now
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
