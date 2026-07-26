/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck -- imported prototype UI is intentionally untyped while its real workflows are integrated.
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, BookOpen, Bot, Check, ChevronDown, ChevronRight,
  CircleAlert, Clock3, Download, File, FileAudio, FileImage, FileText,
  FileVideo, Filter, FolderOpen, Languages, Link2, MessageSquareText,
  MoreHorizontal, Paperclip, Play, Plus, Search, Send, ShieldCheck,
  Sparkles, Upload, Users, WandSparkles, X
} from "lucide-react";

const evidence = [
  { id: 1, name: "Purchase Agreement.pdf", meta: "12 pages · English", type: "pdf", date: "12 Feb 2024", tag: "Contract", color: "red" },
  { id: 2, name: "WhatsApp Export — Rajesh", meta: "187 messages · Hinglish", type: "chat", date: "14 Feb–18 Mar", tag: "Messages", color: "green" },
  { id: 3, name: "Site inspection.mp4", meta: "18:42 · Hindi", type: "video", date: "28 Feb 2024", tag: "Video", color: "purple" },
  { id: 4, name: "Payment receipt.jpg", meta: "2.4 MB · Hindi", type: "image", date: "01 Mar 2024", tag: "Receipt", color: "blue" },
  { id: 5, name: "Call with contractor.m4a", meta: "09:16 · Marathi", type: "audio", date: "12 Mar 2024", tag: "Audio", color: "amber" },
  { id: 6, name: "Legal notice.pdf", meta: "4 pages · English", type: "pdf", date: "05 Apr 2024", tag: "Notice", color: "red" }
];

const events = [
  {
    date: "12 FEB 2024", title: "Purchase agreement executed", icon: FileText,
    body: "Aarav Mehta agrees to purchase Flat 804 from Horizon Builders for ₹1.85 crore. Possession promised by 31 March 2024.",
    cites: [{ label: "Purchase Agreement · p. 3", id: 1, detail: "Clause 7.1" }],
    kind: "agreement", people: ["Aarav Mehta", "Horizon Builders"], amount: "₹1.85 Cr"
  },
  {
    date: "15 FEB 2024", title: "Initial payment acknowledged", icon: MessageSquareText,
    body: "Rajesh confirms receipt of the ₹37 lakh booking amount and states that construction is “on track.”",
    cites: [{ label: "WhatsApp · msg 42", id: 2, detail: "10:23 AM" }],
    kind: "payment", people: ["Rajesh Sharma"], amount: "₹37 L"
  },
  {
    date: "28 FEB 2024", title: "Site inspection shows unfinished work", icon: FileVideo,
    body: "Video evidence shows incomplete electrical work, unpainted walls, and absent fixtures in Flat 804.",
    cites: [{ label: "Site inspection · 04:12", id: 3, detail: "Hindi → English" }, { label: "Site inspection · 11:38", id: 3, detail: "Visual" }],
    kind: "site", people: ["Aarav Mehta"]
  },
  {
    date: "01 MAR 2024", title: "Second payment of ₹55.5 lakh", icon: FileImage,
    body: "Bank receipt records the transfer to Horizon Builders. The receipt memo references milestone completion.",
    cites: [{ label: "Payment receipt · image", id: 4, detail: "OCR verified" }],
    kind: "payment", people: ["Horizon Builders"], amount: "₹55.5 L",
    flag: "Milestone appears inconsistent with site condition one day earlier."
  },
  {
    date: "12 MAR 2024", title: "Contractor admits likely delay", icon: FileAudio,
    body: "The contractor says handover before late May is unlikely due to material and labour shortages.",
    cites: [{ label: "Call recording · 06:44", id: 5, detail: "Marathi → English" }],
    kind: "call", people: ["Rajesh Sharma"],
    flag: "Contradicts Rajesh’s 15 February assurance that work was on track."
  },
  {
    date: "05 APR 2024", title: "Legal notice served", icon: FileText,
    body: "Counsel demands possession within 15 days or refund with 18% interest and damages.",
    cites: [{ label: "Legal notice · p. 2", id: 6, detail: "Demand §4" }],
    kind: "notice", people: ["Aarav Mehta"], amount: "18% interest"
  }
];

const sourceDetail = {
  1: { title: "Purchase Agreement.pdf", meta: "Page 3 of 12 · Clause 7.1", excerpt: "The Developer shall complete and hand over vacant possession of the said Apartment to the Purchaser on or before 31 March 2024, subject to the terms herein.", marker: "p. 3" },
  2: { title: "WhatsApp Export — Rajesh", meta: "Message 42 · 15 Feb, 10:23 AM", excerpt: "Rajesh Sharma: Payment received, thank you. Everything is on track and we will hand over by the date in the agreement.", marker: "msg 42" },
  3: { title: "Site inspection.mp4", meta: "Timestamp 04:12 of 18:42 · Hindi", excerpt: "These switchboards are still open. There are no fixtures here, and this entire wall has not received even the first coat.", marker: "04:12" },
  4: { title: "Payment receipt.jpg", meta: "OCR region · Confidence 98.4%", excerpt: "Beneficiary: Horizon Builders Pvt. Ltd. Amount: INR 55,50,000. Remarks: Milestone payment — finishing complete.", marker: "OCR" },
  5: { title: "Call with contractor.m4a", meta: "Timestamp 06:44 of 09:16 · Marathi", excerpt: "Mayच्या शेवटच्या आधी देणं कठीण आहे. Material आणि workers दोन्ही कमी आहेत.", translation: "It will be difficult to deliver before the end of May. Both material and workers are in short supply.", marker: "06:44" },
  6: { title: "Legal notice.pdf", meta: "Page 2 of 4 · Demand §4", excerpt: "You are hereby called upon to hand over possession within fifteen days, failing which our client shall seek refund with interest at 18% per annum and damages.", marker: "p. 2" }
};

const IconFor = ({ type }) => {
  const Comp = type === "video" ? FileVideo : type === "audio" ? FileAudio : type === "image" ? FileImage : type === "chat" ? MessageSquareText : FileText;
  return <Comp size={18} />;
};

export default function CaseLens() {
  const router = useRouter();
  const [section, setSection] = useState("Timeline");
  const [source, setSource] = useState(sourceDetail[3]);
  const [rightOpen, setRightOpen] = useState(true);
  const [filter, setFilter] = useState("All events");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState("");
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadedEvidence, setUploadedEvidence] = useState([]);

  const visibleEvents = useMemo(() => {
    if (filter === "All events") return events;
    if (filter === "Flagged") return events.filter(e => e.flag);
    if (filter === "Payments") return events.filter(e => e.kind === "payment");
    return events;
  }, [filter]);

  function openSource(id) {
    setSource(sourceDetail[id]);
    setRightOpen(true);
  }

  async function ask(text) {
    const q = (text || query).trim();
    if (!q) return;
    setQuery(q);
    setAnswer({ question: q, text: "Searching processed evidence with Sarvam…", cites: [] });
    try {
      const response = await fetch("/api/knowledge-query", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Question failed.");
      setAnswer({
        question: q,
        text: data.answer,
        cites: data.sources.slice(0, 6).map(source => ({ id: null, label: `SOURCE-${source.id} · ${source.fileName}` })),
      });
    } catch (error) {
      setAnswer({ question: q, text: error instanceof Error ? error.message : "Unable to answer.", cites: [] });
    }
  }

  async function processEvidence(files) {
    if (!files.length) return;
    setProcessing(true);
    setUploadProgress("Preparing evidence…");
    try {
      const items = [];
      const media = files.filter(file => file.type.startsWith("audio/") || file.type.startsWith("video/"));
      const pdfs = files.filter(file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
      const texts = files.filter(file => file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt"));

      if (media.length) {
        setUploadProgress(`Sending ${media.length} media files as one Sarvam batch…`);
        const body = new FormData();
        media.forEach(file => body.append("files", file));
        body.append("translateTranscript", "true");
        body.append("targetLanguage", "en-IN");
        const response = await fetch("/api/batch-process", { method: "POST", body });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Media processing failed.");
        items.push(...data.items);
      }

      for (let index = 0; index < pdfs.length; index++) {
        const file = pdfs[index];
        setUploadProgress(`Digitizing PDF ${index + 1} of ${pdfs.length} with Sarvam…`);
        const body = new FormData(); body.append("file", file); body.append("language", "en-IN");
        const response = await fetch("/api/document-process", { method: "POST", body });
        const data = await response.json();
        if (!response.ok) throw new Error(`${file.name}: ${data.error || "PDF processing failed."}`);
        items.push(data);
      }

      for (let index = 0; index < texts.length; index++) {
        const file = texts[index];
        setUploadProgress(`Analyzing TXT ${index + 1} of ${texts.length} with Sarvam…`);
        const body = new FormData(); body.append("file", file);
        const response = await fetch("/api/case-analyze", { method: "POST", body });
        const data = await response.json();
        if (!response.ok) throw new Error(`${file.name}: ${data.error || "TXT analysis failed."}`);
        items.push({ fileName: file.name, mediaType: "text/plain", transcript: await file.text(), analysisId: data.id });
      }

      if (!items.length) throw new Error("Choose PDF, TXT, audio, or video files.");
      setUploadProgress("Summarizing all evidence with Sarvam…");
      const summaryResponse = await fetch("/api/summarize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const summary = await summaryResponse.json();
      if (!summaryResponse.ok) throw new Error(summary.error || "Evidence summary failed.");

      setUploadProgress("Saving evidence to the knowledge base…");
      const saveResponse = await fetch("/api/knowledge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: files.length === 1 ? files[0].name : `${files.length} evidence files`,
          summary: summary.summary,
          items: items.map(item => ({
            fileName: item.fileName,
            mediaType: item.mediaType,
            transcript: item.transcript,
            translatedText: item.translatedText,
            languageCode: item.languageCode,
          })),
        }),
      });
      const saved = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saved.error || "Knowledge-base save failed.");
      setUploadedEvidence(items.map((item, index) => ({
        id: `uploaded-${Date.now()}-${index}`, name: item.fileName, meta: "Processed with Sarvam",
        type: item.mediaType.includes("pdf") ? "pdf" : item.mediaType.includes("text") ? "chat" : item.mediaType.includes("video") ? "video" : "audio",
        date: "Just now", tag: item.mediaType.includes("pdf") ? "Document" : item.mediaType.includes("text") ? "Messages" : "Media",
        color: item.mediaType.includes("pdf") ? "red" : item.mediaType.includes("text") ? "green" : "purple",
      })));
      setShowUpload(false);
      setSection("Evidence");
      setToast(`${items.length} evidence source${items.length === 1 ? "" : "s"} processed and saved`);
      setTimeout(() => setToast(""), 4000);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Evidence processing failed");
    } finally {
      setProcessing(false);
      setUploadProgress("");
    }
  }

  const nav = [
    ["Overview", BookOpen], ["Evidence", FolderOpen], ["Timeline", Clock3],
    ["Contradictions", CircleAlert, 2], ["Ask CaseLens", Bot], ["Case brief", FileText]
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">C</div><span>CaseLens</span></div>
        <button className="case-switch">
          <span className="case-dot">AM</span>
          <span><b>Mehta v. Horizon Builders</b><small>Property dispute · CL-2024-018</small></span>
          <ChevronDown size={16} />
        </button>
        <div className="top-actions">
          <div className="sarvam-pill"><Languages size={14}/><span>Multilingual by</span><b>sarvam</b></div>
          <button className="icon-btn"><Search size={18}/></button>
          <button className="avatar">TK</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <nav>
            {nav.map(([label, Icon, count]) => (
              <button key={label} className={section === label ? "active" : ""} onClick={() => setSection(label)}>
                <Icon size={17}/><span>{label}</span>{count && <em>{count}</em>}
              </button>
            ))}
          </nav>
          <div className="sidebar-divider"/>
          <div className="case-health">
            <div className="eyebrow">CASE READINESS</div>
            <div className="health-head"><b>Evidence strength</b><span>76%</span></div>
            <div className="progress"><i style={{width:"76%"}}/></div>
            <p><Check size={13}/> 6 sources processed</p>
            <p><Check size={13}/> 14 events linked</p>
            <p className="warn"><CircleAlert size={13}/> 2 gaps need review</p>
          </div>
          <button className="upload-btn" onClick={() => setShowUpload(true)}><Upload size={16}/> Add evidence</button>
        </aside>

        <section className={`main-panel ${rightOpen ? "" : "wide"}`}>
          {section === "Timeline" && (
            <>
              <div className="page-head">
                <div><div className="breadcrumb">MEHTA V. HORIZON BUILDERS <ChevronRight size={13}/> CASE RECONSTRUCTION</div><h1>Case timeline</h1><p>14 events reconstructed from 6 evidence sources</p></div>
                <div className="head-actions">
                  <button className="secondary" onClick={() => setToast("Timeline exported")}><Download size={15}/> Export</button>
                  <button className="primary" onClick={() => setSection("Case brief")}><WandSparkles size={15}/> Generate brief</button>
                </div>
              </div>
              <div className="filterbar">
                {["All events", "Payments", "Flagged"].map(f => <button key={f} className={filter === f ? "selected" : ""} onClick={() => setFilter(f)}>{f}{f === "Flagged" && <span>2</span>}</button>)}
                <div className="grow"/>
                <button><Filter size={14}/> Filter</button>
                <button><Users size={14}/> People</button>
              </div>
              <div className="timeline-wrap">
                <div className="timeline">
                  {visibleEvents.map((event, i) => {
                    const EIcon = event.icon;
                    return <article className="event" key={event.title}>
                      <div className="event-date">{event.date}</div>
                      <div className={`event-node ${event.flag ? "flagged" : ""}`}><EIcon size={15}/></div>
                      <div className={`event-card ${event.flag ? "has-flag" : ""}`}>
                        <div className="event-title"><h3>{event.title}</h3>{event.amount && <span className="amount">{event.amount}</span>}<button><MoreHorizontal size={17}/></button></div>
                        <p>{event.body}</p>
                        {event.flag && <div className="inline-flag"><CircleAlert size={14}/><span>{event.flag}</span><button onClick={() => setSection("Contradictions")}>Review</button></div>}
                        <div className="cites">
                          {event.cites.map((c, j) => <button key={j} onClick={() => openSource(c.id)}><Link2 size={12}/>{c.label}<small>{c.detail}</small></button>)}
                        </div>
                      </div>
                    </article>
                  })}
                </div>
              </div>
            </>
          )}

          {section === "Evidence" && <EvidenceView uploadedEvidence={uploadedEvidence} onOpen={openSource} onUpload={() => setShowUpload(true)}/>}
          {section === "Contradictions" && <Contradictions onOpen={openSource}/>}
          {section === "Ask CaseLens" && <AskView query={query} setQuery={setQuery} ask={ask} answer={answer} onOpen={openSource}/>}
          {section === "Case brief" && <BriefView onOpen={openSource} notify={setToast}/>}
          {section === "Overview" && <Overview onNavigate={setSection}/>}
        </section>

        {rightOpen && <SourcePanel source={source} onClose={() => setRightOpen(false)}/>}
        {!rightOpen && <button className="reopen" onClick={() => setRightOpen(true)}><BookOpen size={16}/> Source</button>}
      </div>

      <div className="askbar">
        <Sparkles size={17}/>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} placeholder="Ask anything about this case…"/>
        <span>Grounded in 6 sources</span>
        <button onClick={() => { setSection("Ask CaseLens"); ask(); }}><ArrowRight size={17}/></button>
      </div>

      {showUpload && <UploadModal processing={processing} progress={uploadProgress} onClose={() => !processing && setShowUpload(false)} onProcess={processEvidence} onMedia={() => router.push("/media")} onWhatsApp={() => router.push("/cases")}/>}
      {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    </main>
  );
}

function SourcePanel({ source, onClose }) {
  return <aside className="source-panel">
    <div className="source-head"><div><span className="live-dot"/>SOURCE VERIFICATION</div><button onClick={onClose}><X size={17}/></button></div>
    <div className="doc-head"><FileText size={20}/><div><b>{source.title}</b><small>{source.meta}</small></div><button><MoreHorizontal size={17}/></button></div>
    {source.title.includes(".mp4") && <div className="video-preview"><div className="room"><span className="door"/><span className="wire"/><span className="wall"/></div><button><Play size={18} fill="currentColor"/></button><div className="video-time">04:12 / 18:42</div></div>}
    {source.title.includes(".m4a") && <div className="audio-preview"><button><Play size={17} fill="currentColor"/></button><div className="wave">{Array.from({length:35}).map((_,i)=><i key={i} style={{height:`${8 + (i*13)%27}px`}}/>)}</div><span>06:44</span></div>}
    <div className="source-body">
      <div className="location"><span>{source.marker}</span><div></div></div>
      <p className="excerpt">“{source.excerpt}”</p>
      {source.translation && <div className="translation"><div><Languages size={13}/> SARVAM TRANSLATION</div><p>“{source.translation}”</p></div>}
      <div className="verified"><ShieldCheck size={16}/><div><b>Linked to original</b><span>Source hash verified · No edits detected</span></div></div>
      <div className="entities"><div className="eyebrow">EXTRACTED FROM THIS PASSAGE</div><span>Possession date</span><b>31 Mar 2024</b><span>Party</span><b>Developer</b></div>
    </div>
    <div className="source-foot"><button><ArrowLeft size={14}/> Previous</button><button>Open full source <ArrowRight size={14}/></button></div>
  </aside>
}

function EvidenceView({ uploadedEvidence, onOpen, onUpload }) {
  const allEvidence = [...uploadedEvidence, ...evidence];
  return <div className="view-pad">
    <div className="page-head"><div><div className="breadcrumb">CASE MATERIALS</div><h1>Evidence</h1><p>Every source is processed, searchable, and traceable.</p></div><button className="primary" onClick={onUpload}><Upload size={15}/> Add evidence</button></div>
    <div className="stats-row"><Stat n="6" label="Sources"/><Stat n="323" label="Extracted items"/><Stat n="4" label="Languages"/><Stat n="100%" label="Provenance linked"/></div>
    <div className="evidence-table">
      <div className="table-head"><span>Source</span><span>Evidence date</span><span>Type</span><span>Status</span><span></span></div>
      {allEvidence.map(e => <button className="evidence-row" key={e.id} onClick={() => typeof e.id === "number" && onOpen(e.id)}>
        <div className={`file-icon ${e.color}`}><IconFor type={e.type}/></div><div className="file-name"><b>{e.name}</b><small>{e.meta}</small></div><span>{e.date}</span><span><i className={`tag ${e.color}`}>{e.tag}</i></span><span className="processed"><Check size={13}/> Processed</span><ChevronRight size={15}/>
      </button>)}
    </div>
  </div>
}

function Stat({n,label}) { return <div className="stat"><b>{n}</b><span>{label}</span></div> }

function Contradictions({onOpen}) {
  return <div className="view-pad"><div className="page-head"><div><div className="breadcrumb">REASONING REVIEW</div><h1>Contradictions & gaps</h1><p>Potential inconsistencies detected across independent sources.</p></div></div>
    <div className="insight-banner"><Sparkles size={18}/><div><b>CaseLens found 2 material contradictions</b><p>These are leads for lawyer review, not legal conclusions.</p></div></div>
    <div className="contradiction-card"><div className="severity">HIGH RELEVANCE</div><h3>Was the project “on track” in February?</h3><p>Two statements about the expected completion date cannot both be accurate.</p>
      <div className="compare"><button onClick={()=>onOpen(2)}><span>15 FEB · WHATSAPP</span><blockquote>“Everything is on track and we will hand over by the date in the agreement.”</blockquote><b><Link2 size={12}/> msg 42</b></button><div>VS</div><button onClick={()=>onOpen(5)}><span>12 MAR · CALL</span><blockquote>“It will be difficult to deliver before the end of May.”</blockquote><b><Link2 size={12}/> 06:44</b></button></div>
      <div className="analysis-note"><Bot size={16}/><p><b>Why this matters:</b> The later admission, together with the unfinished site video, may undermine the earlier assurance and support a claim of misrepresentation.</p></div>
    </div>
    <div className="contradiction-card gap"><div className="severity">MISSING EVIDENCE</div><h3>Milestone completion certificate not found</h3><p>The ₹55.5 lakh receipt references “finishing complete,” but no supporting inspection certificate or written milestone approval appears in the uploaded evidence.</p><button className="secondary"><Plus size={14}/> Request document</button></div>
  </div>
}

function AskView({query,setQuery,ask,answer,onOpen}) {
  const prompts = ["What evidence proves the delay?", "How much has the client paid?", "Summarise all admissions by Rajesh"];
  return <div className="ask-view"><div className="ask-hero"><div className="bot-orb"><Sparkles size={24}/></div><h1>Ask CaseLens</h1><p>Answers are grounded only in your uploaded evidence. Every claim links back to its original source.</p>
    <div className="large-ask"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="Ask a question about this case…"/><button onClick={()=>ask()}><Send size={17}/></button></div>
    <div className="prompt-chips">{prompts.map(p=><button key={p} onClick={()=>ask(p)}>{p}</button>)}</div></div>
    {answer && <article className="answer"><div className="answer-label"><Bot size={16}/> CASELENS ANSWER <span><ShieldCheck size={13}/> Evidence-grounded</span></div><h2>{answer.question}</h2><p>{answer.text}</p><div className="answer-cites">{answer.cites.map(c=><button key={c.label} onClick={()=>c.id && onOpen(c.id)}><Link2 size={13}/>{c.label}</button>)}</div><div className="answer-foot">Generated only from processed case evidence <button onClick={()=>navigator.clipboard.writeText(answer.text)}>Copy answer</button></div></article>}
  </div>
}

function BriefView({onOpen,notify}) {
  return <div className="view-pad brief"><div className="page-head"><div><div className="breadcrumb">DRAFT · AI GENERATED</div><h1>Case brief</h1><p>Structured from verified evidence. Review before use.</p></div><div className="head-actions"><button className="secondary" onClick={()=>notify("Brief copied to clipboard")}><Paperclip size={15}/> Copy</button><button className="primary" onClick={()=>notify("Case brief exported as PDF")}><Download size={15}/> Export PDF</button></div></div>
    <article className="brief-paper"><div className="brief-title"><span>CASE BRIEF</span><h2>Aarav Mehta v. Horizon Builders Pvt. Ltd.</h2><p>Property possession delay and alleged misrepresentation</p></div>
      <BriefSection n="01" title="Question presented"><p>Whether Horizon Builders breached its contractual obligation to deliver possession by 31 March 2024 and misrepresented the project’s completion status while accepting further payment.</p></BriefSection>
      <BriefSection n="02" title="Key facts"><p>On 12 February 2024, the parties executed a purchase agreement for ₹1.85 crore, requiring possession by 31 March 2024. <button onClick={()=>onOpen(1)}>[Agreement, p. 3]</button></p><p>Despite a 15 February assurance that work was on track, a 28 February inspection showed major finishing work incomplete. <button onClick={()=>onOpen(2)}>[WhatsApp, msg 42]</button> <button onClick={()=>onOpen(3)}>[Video, 04:12]</button></p></BriefSection>
      <BriefSection n="03" title="Evidence assessment"><div className="brief-grid"><div><b>Strongest support</b><p>Contemporaneous site video and contractor admission independently corroborate anticipated delay.</p></div><div><b>Material gap</b><p>No milestone completion certificate supports the description on the second payment receipt.</p></div></div></BriefSection>
      <BriefSection n="04" title="Relief claimed"><p>Possession, or refund of amounts paid with interest at 18% per annum, together with damages and costs. <button onClick={()=>onOpen(6)}>[Legal notice, p. 2]</button></p></BriefSection>
    </article>
  </div>
}

function BriefSection({n,title,children}) { return <section className="brief-section"><div><span>{n}</span><h3>{title}</h3></div><div>{children}</div></section> }

function Overview({onNavigate}) {
  return <div className="view-pad"><div className="page-head"><div><div className="breadcrumb">CASE OVERVIEW</div><h1>Mehta v. Horizon Builders</h1><p>Property dispute · Last updated today at 10:42</p></div></div>
    <div className="overview-grid"><div className="summary-card"><div className="eyebrow">AI CASE SUMMARY</div><h2>Possession delay after ₹92.5 lakh in payments</h2><p>The evidence indicates that Horizon Builders accepted two payments while the property remained materially incomplete. A contractor later acknowledged that delivery would likely be delayed until late May, contrary to an earlier assurance.</p><button onClick={()=>onNavigate("Timeline")}>Explore timeline <ArrowRight size={15}/></button></div>
    <div className="metric-card"><span>AMOUNT PAID</span><b>₹92.5L</b><small>50% of consideration</small></div><div className="metric-card"><span>DELAY</span><b>61+ days</b><small>Against contract date</small></div></div>
    <div className="next-steps"><h3>Continue building the case</h3><button onClick={()=>onNavigate("Contradictions")}><CircleAlert size={18}/><span><b>Review 2 contradictions</b><small>Resolve inconsistencies before drafting</small></span><ChevronRight/></button><button onClick={()=>onNavigate("Ask CaseLens")}><Bot size={18}/><span><b>Question the evidence</b><small>Get answers with exact citations</small></span><ChevronRight/></button><button onClick={()=>onNavigate("Case brief")}><FileText size={18}/><span><b>Review case brief</b><small>Drafted from 6 verified sources</small></span><ChevronRight/></button></div>
  </div>
}

function UploadModal({processing,progress,onClose,onProcess,onMedia,onWhatsApp}) {
  const [files, setFiles] = useState([]);
  return <div className="modal-backdrop"><div className="modal"><button className="modal-close" disabled={processing} onClick={onClose}><X/></button><div className="upload-art"><Upload size={25}/></div><h2>{processing ? "Processing evidence…" : "Add evidence"}</h2><p>{processing ? progress : "Upload PDFs, WhatsApp TXT exports, audio, and video together."}</p>
    {processing ? <div className="process-list"><div className="spinner"/><span>{progress}</span><div className="process-bar"><i/></div></div> : <><label className="dropzone"><Upload size={22}/><b>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Drop files here or choose files"}</b><span>PDF, TXT, MP4, MP3, M4A, WAV and WebM</span><input type="file" multiple accept=".pdf,.txt,audio/*,video/*" hidden onChange={event => setFiles(Array.from(event.target.files || []))}/></label><button className="primary full" disabled={!files.length} onClick={() => onProcess(files)}>Upload & process evidence <ArrowRight size={15}/></button><div className="language-row"><FileVideo size={16}/><div><b>Advanced media options</b><span>Choose translation language and voice</span></div><button onClick={onMedia}>Open <ArrowRight size={14}/></button></div><div className="language-row"><MessageSquareText size={16}/><div><b>Advanced WhatsApp analysis</b><span>Theory mode and cited questions</span></div><button onClick={onWhatsApp}>Open <ArrowRight size={14}/></button></div></>}
  </div></div>
}
