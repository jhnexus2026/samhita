"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Layers,
  FileInput,
  ScanSearch,
  BrainCircuit,
  Ruler,
  Box,
  ServerCog,
  ScanLine,
  ShieldCheck,
  BarChart3,
  Database,
  FileText,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6 },
  }),
};

const pipelineSteps = [
  {
    num: 1,
    icon: FileInput,
    title: "Document Ingestion",
    desc: "Upload PDFs, scanned images, or photos of handwritten prescriptions. Multi-page documents are automatically split and queued.",
  },
  {
    num: 2,
    icon: ScanSearch,
    title: "Vision Analysis",
    desc: "Gemini 2.0 Flash Vision AI reads tables, handwriting, stamps, and Hindi-English mixed text with contextual understanding.",
  },
  {
    num: 3,
    icon: BrainCircuit,
    title: "Clinical NLP",
    desc: "Llama 3.3 70B extracts diagnoses, procedures, medications, and vitals — resolving negations and medical abbreviations.",
  },
  {
    num: 4,
    icon: Ruler,
    title: "Code Normalization",
    desc: "FAISS vector search maps entities to ICD-10, CPT, and LOINC codes with confidence scoring. No keyword guessing.",
  },
  {
    num: 5,
    icon: Box,
    title: "FHIR R4 Assembly",
    desc: "Normalized data is composed into validated FHIR R4 Bundles — Patient, Condition, Procedure, Observation resources.",
  },
  {
    num: 6,
    icon: ServerCog,
    title: "Billing Reconciliation",
    desc: "Compares clinical documentation against billing to detect missed charges, phantom billing, and revenue leakage.",
  },
];

const features = [
  {
    icon: ScanLine,
    title: "Advanced Spatial Vision",
    desc: "Unlike legacy OCR that reads character-by-character, our multimodal architecture analyzes documents contextually — parsing complex tables, nested layouts, and illegible handwriting.",
    hoverBg: "group-hover:bg-indigo-100",
    hoverText: "group-hover:text-indigo-600",
  },
  {
    icon: ShieldCheck,
    title: "Human-in-the-Loop Safety",
    desc: "High-confidence data flows automatically. Low-confidence extractions are routed to your clinical team for verification. Every mapping carries a confidence score.",
    hoverBg: "group-hover:bg-violet-100",
    hoverText: "group-hover:text-violet-600",
  },
  {
    icon: BarChart3,
    title: "Revenue Recovery Engine",
    desc: "Automatically detects missed charges, phantom billing, and duplicate codes. Quantifies revenue leakage in real-time with per-document financial impact analysis.",
    hoverBg: "group-hover:bg-indigo-100",
    hoverText: "group-hover:text-indigo-600",
  },
];

export default function LandingPage() {
  return (
    <div
      className="text-neutral-900 selection:bg-indigo-200 selection:text-indigo-900 overflow-x-hidden relative"
      style={{
        background: "linear-gradient(135deg, #faf5ff 0%, #f5f3ff 20%, #eef2ff 40%, #f8fafc 60%, #f5f3ff 80%, #faf5ff 100%)",
        backgroundSize: "400% 400%",
        animation: "bgGradientShift 15s ease infinite",
      }}
    >
      {/* Floating Background Shapes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {/* Large hexagon — top left */}
        <svg className="absolute -top-20 -left-16 w-72 h-72 opacity-[0.13]" viewBox="0 0 200 200" style={{ animation: "shapeFloat 22s ease-in-out infinite" }}>
          <polygon points="100,10 180,50 180,150 100,190 20,150 20,50" fill="none" stroke="#7c3aed" strokeWidth="2" />
        </svg>
        {/* Circle ring — top right */}
        <svg className="absolute top-40 -right-10 w-80 h-80 opacity-[0.11]" viewBox="0 0 200 200" style={{ animation: "shapeFloat 28s ease-in-out infinite reverse" }}>
          <circle cx="100" cy="100" r="85" fill="none" stroke="#6366f1" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="60" fill="none" stroke="#6366f1" strokeWidth="1" />
        </svg>
        {/* Triangle — mid left */}
        <svg className="absolute top-[35%] -left-8 w-48 h-48 opacity-[0.12]" viewBox="0 0 200 200" style={{ animation: "shapeFloat2 25s ease-in-out infinite" }}>
          <polygon points="100,15 190,180 10,180" fill="none" stroke="#8b5cf6" strokeWidth="2" />
        </svg>
        {/* Diamond — center right */}
        <svg className="absolute top-[55%] right-[5%] w-40 h-40 opacity-[0.14]" viewBox="0 0 200 200" style={{ animation: "shapeFloat 20s ease-in-out infinite" }}>
          <polygon points="100,10 190,100 100,190 10,100" fill="none" stroke="#a78bfa" strokeWidth="2" />
        </svg>
        {/* Small hexagon — bottom left */}
        <svg className="absolute bottom-[20%] left-[8%] w-36 h-36 opacity-[0.12]" viewBox="0 0 200 200" style={{ animation: "shapeFloat2 18s ease-in-out infinite reverse" }}>
          <polygon points="100,10 180,50 180,150 100,190 20,150 20,50" fill="none" stroke="#7c3aed" strokeWidth="1.5" />
        </svg>
        {/* Cross / plus — bottom right */}
        <svg className="absolute bottom-[10%] right-[12%] w-32 h-32 opacity-[0.10]" viewBox="0 0 200 200" style={{ animation: "shapeFloat 30s ease-in-out infinite" }}>
          <line x1="100" y1="30" x2="100" y2="170" stroke="#6366f1" strokeWidth="2" />
          <line x1="30" y1="100" x2="170" y2="100" stroke="#6366f1" strokeWidth="2" />
        </svg>
        {/* Pentagon — far mid */}
        <svg className="absolute top-[75%] left-[40%] w-52 h-52 opacity-[0.10]" viewBox="0 0 200 200" style={{ animation: "shapeFloat2 26s ease-in-out infinite" }}>
          <polygon points="100,10 190,78 155,180 45,180 10,78" fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
        </svg>
        {/* Dotted circle — top center */}
        <svg className="absolute top-[12%] left-[45%] w-44 h-44 opacity-[0.11]" viewBox="0 0 200 200" style={{ animation: "shapeFloat 24s ease-in-out infinite reverse" }}>
          <circle cx="100" cy="100" r="80" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="8 6" />
        </svg>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b backdrop-blur-md border-neutral-200 bg-neutral-50/80">
        <div className="flex max-w-7xl mx-auto py-4 px-6 items-center justify-between">
          <span className="text-xl font-semibold tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-600">
            SAMHITA
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-500">
            <a href="#platform" className="transition-colors hover:text-indigo-600">Platform</a>
            <a href="#pipeline" className="transition-colors hover:text-indigo-600">Pipeline</a>
            <a href="#solutions" className="transition-colors hover:text-indigo-600">Solutions</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="hidden md:block text-sm font-medium text-neutral-600 hover:text-indigo-600 transition-colors">
              Dashboard
            </Link>
            <Link
              href="/upload"
              className="rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="md:pt-32 md:pb-40 overflow-hidden pt-24 pb-32 relative">
        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-500/20 via-violet-500/20 to-fuchsia-500/20 blur-[100px] rounded-full mix-blend-multiply pointer-events-none -z-10 animate-pulse" style={{ transform: "translate(-50%, -50%)" }} />
        {/* Animated Grid */}
        <div
          className="absolute inset-0 -z-20 pointer-events-none opacity-40"
          style={{
            backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            animation: "panGrid 2s linear infinite",
          }}
        />

        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <motion.h1
            initial="hidden"
            animate="visible"
            custom={0}
            variants={fadeInUp}
            className="mx-auto max-w-4xl text-5xl md:text-7xl font-semibold tracking-tight mb-8 leading-tight text-neutral-900"
          >
            Structured clinical data{" "}
            <br className="hidden md:block" />
            from unstructured{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-500">
              chaos.
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={1}
            variants={fadeInUp}
            className="mx-auto max-w-2xl text-lg md:text-xl text-neutral-600 font-normal mb-10 leading-relaxed"
          >
            Samhita is an enterprise-grade Clinical Intelligence Layer. We transform
            discharge summaries, handwritten notes, and lab reports into
            interoperable, billing-ready structured data.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            custom={2}
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/upload"
              className="w-full sm:w-auto rounded-md px-6 py-3 text-base font-medium transition-all duration-200 bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
            >
              Start Processing
            </Link>
            <a
              href="#platform"
              className="w-full sm:w-auto rounded-md border px-6 py-3 text-base font-medium transition-all duration-200 flex items-center justify-center gap-2 border-neutral-200 bg-white/80 backdrop-blur-sm text-neutral-700 hover:bg-white hover:border-neutral-300 hover:shadow-md active:scale-95"
            >
              <Layers className="h-5 w-5 text-indigo-500" />
              Explore Platform
            </a>
          </motion.div>
        </div>

        {/* Hero Demo Card */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={3}
          variants={fadeInUp}
          className="relative z-10 mx-auto mt-20 max-w-5xl px-6"
        >
          <div className="rounded-xl border p-2 shadow-xl shadow-indigo-900/5 border-neutral-200 bg-white/80 backdrop-blur-md hover:shadow-2xl transition-shadow duration-500">
            <div className="rounded-lg border overflow-hidden flex flex-col md:flex-row border-neutral-100 bg-white">
              {/* Left: Unstructured */}
              <div className="flex-1 p-6 md:border-r border-neutral-100">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-[18px] w-[18px] text-indigo-400" />
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                    Raw Input (Handwritten/PDF)
                  </span>
                </div>
                <div className="font-mono text-sm leading-relaxed p-4 rounded border shadow-sm transition-colors text-neutral-600 bg-neutral-50 border-neutral-200 hover:border-indigo-200 hover:shadow-md">
                  <span className="text-neutral-400">{"// Scanned Clinical Note"}</span>
                  <br /><br />
                  Pt admitted with c/o severe{" "}
                  <span className="px-1 rounded bg-red-100/80 text-red-800">SOB</span>{" "}
                  and cough.{" "}
                  <span className="px-1 rounded bg-blue-100/80 text-blue-800">RBS: 210 mg/dL</span>.{" "}
                  No fever noted.
                  <br /><br />
                  Plan: Start{" "}
                  <span className="px-1 rounded bg-green-100/80 text-green-800">Metformin 500mg BD</span>.
                </div>
              </div>

              {/* Middle Arrow */}
              <div className="hidden md:flex items-center justify-center px-4 relative bg-neutral-50/50">
                <div className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-indigo-300 to-transparent" />
                <div className="rounded-full border p-2 shadow-md z-10 transition-all duration-500 hover:scale-110 hover:shadow-indigo-500/20 bg-white border-indigo-100 text-indigo-500">
                  <ArrowRight className="h-6 w-6" />
                </div>
              </div>

              {/* Right: Structured */}
              <div className="flex-1 p-6 bg-slate-900 text-neutral-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-2xl rounded-full" />
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <Database className="h-[18px] w-[18px] text-violet-400" />
                  <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
                    FHIR Resource Output
                  </span>
                </div>
                <pre className="font-mono text-xs leading-relaxed overflow-x-auto relative z-10">
                  <code className="text-neutral-300">
                    {`"Condition": [\n  {\n    "entity": "Shortness of Breath",\n    "original": "SOB",\n    "code": "R06.02",\n    "confidence": 0.98\n  }\n],`}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Platform Section */}
      <section id="platform" className="py-24 border-t bg-white/70 backdrop-blur-sm border-neutral-100">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row gap-16 items-center">
            <div className="flex-1">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl md:text-4xl font-semibold tracking-tight mb-6 text-neutral-900"
              >
                A robust platform for clinical data operations.
              </motion.h2>
              <p className="text-lg text-neutral-500 mb-10">
                Samhita doesn&apos;t just extract text; it understands medical context,
                maps to global ontologies, and detects billing discrepancies in
                real-time.
              </p>

              <div className="space-y-8">
                {features.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4 group cursor-pointer"
                  >
                    <div className={`mt-1 rounded-lg p-2 h-fit transition-all duration-300 bg-neutral-100 shadow-sm group-hover:shadow-md ${f.hoverBg}`}>
                      <f.icon className={`h-5 w-5 text-neutral-600 transition-colors ${f.hoverText}`} />
                    </div>
                    <div>
                      <h4 className="text-lg font-medium mb-1 text-neutral-900 transition-colors">
                        {f.title}
                      </h4>
                      <p className="text-sm text-neutral-500">{f.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t py-12 border-neutral-200 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <span className="text-xl font-semibold tracking-tighter uppercase text-neutral-900">
            SAMHITA
          </span>
          <div className="flex gap-6 text-sm text-neutral-500 font-medium">
            <Link href="/dashboard" className="transition-colors hover:text-indigo-600">Dashboard</Link>
            <Link href="/upload" className="transition-colors hover:text-indigo-600">Upload</Link>
            <Link href="/review" className="transition-colors hover:text-indigo-600">Review</Link>
          </div>
          <div className="text-sm text-neutral-400">
            &copy; {new Date().getFullYear()} Samhita &mdash; All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
