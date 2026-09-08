"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  User,
  CheckCircle2,
  Ticket,
  Sparkles,
  Loader2,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { AIChatMessage, KBArticle } from "@/types/kb";

interface AIAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIAssistantModal({ open, onOpenChange }: AIAssistantModalProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Halo! Saya Asisten AI SI MANTAP 🤖. Ada kendala IT yang bisa saya bantu carikan solusinya?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [escalating, setEscalating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputMessage;
    if (!textToSend.trim() || loading) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputMessage("");
    setLoading(true);

    try {
      // Build history
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSend, history }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.logId) setCurrentLogId(data.logId);

        const aiMsg: AIChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.response,
          articles: data.articles || [],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, aiMsg]);
      } else {
        toast.error(data.error || "Gagal menghubungi AI Assistant");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  const handleEscalateToTicket = async () => {
    if (escalating) return;
    setEscalating(true);

    const lastUserQuery =
      messages.filter((m) => m.role === "user").pop()?.content || "Kendala pengguna";
    const lastAIResponse =
      messages.filter((m) => m.role === "assistant").pop()?.content || "";

    try {
      const res = await fetch("/api/ai/escalate-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: currentLogId,
          userQuery: lastUserQuery,
          aiSummary: lastAIResponse,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Tiket Helpdesk berhasil dibuat!");
        onOpenChange(false);
        router.push(`/tickets`);
      } else {
        toast.error(data.error || "Gagal mengeskalasi ke tiket");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan sistem saat membuat tiket");
    } finally {
      setEscalating(false);
    }
  };

  const handleResolved = () => {
    toast.success("Terima kasih! Senang dapat membantu kendala Anda.");
    onOpenChange(false);
  };

  const quickPrompts = [
    "Printer tidak bisa print",
    "Cara reset password SIMRS",
    "Komputer lambat & lemot",
    "Jaringan Wi-Fi terputus",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-background flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                AI Helpdesk Assistant
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3 text-amber-500 fill-amber-500" /> Powered by Gemini
                </Badge>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Self-Service Trouble-shooting 24/7
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className="space-y-2 max-w-[82%]">
                <div
                  className={`p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted text-foreground rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>

                {/* Suggested KB Articles */}
                {msg.articles && msg.articles.length > 0 && (
                  <div className="bg-background border rounded-xl p-2.5 space-y-1.5 text-xs">
                    <div className="font-semibold text-muted-foreground flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" /> Artikel Terkait:
                    </div>
                    {msg.articles.map((art) => (
                      <div
                        key={art.id}
                        className="p-1.5 rounded bg-muted/50 hover:bg-muted font-medium text-primary cursor-pointer flex items-center justify-between"
                        onClick={() => {
                          onOpenChange(false);
                          router.push(`/knowledge-base?id=${art.id}`);
                        }}
                      >
                        <span>• {art.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {art.category}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-muted-foreground block px-1">
                  {msg.timestamp}
                </span>
              </div>

              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-muted-foreground text-sm">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="p-3 rounded-2xl bg-muted rounded-bl-none flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Mencari solusi di Knowledge Base...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        {messages.length <= 2 && (
          <div className="px-4 py-2 bg-muted/30 border-t flex gap-2 overflow-x-auto text-xs">
            <span className="text-muted-foreground self-center whitespace-nowrap font-medium">
              Topik Populer:
            </span>
            {quickPrompts.map((prompt) => (
              <Badge
                key={prompt}
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground whitespace-nowrap transition-colors"
                onClick={() => handleSendMessage(prompt)}
              >
                {prompt}
              </Badge>
            ))}
          </div>
        )}

        {/* Action Controls when AI responded */}
        {messages.length > 1 && !loading && (
          <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 text-xs gap-1.5 flex-1"
              onClick={handleResolved}
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Masalah Selesai
            </Button>
            <Button
              size="sm"
              variant="default"
              className="text-xs gap-1.5 flex-1"
              onClick={handleEscalateToTicket}
              disabled={escalating}
            >
              {escalating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ticket className="h-4 w-4" />
              )}
              Buat Tiket IT
            </Button>
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 border-t flex items-center gap-2 bg-background"
        >
          <Input
            placeholder="Tuliskan kendala IT Anda..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={loading || !inputMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
