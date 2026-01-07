"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    MessageCircle,
    X,
    Send,
    Loader2,
    Bot,
    User,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    relatedTickets?: { id: string; title: string; category: string }[];
};

const suggestedQuestions = [
    "Printer tidak bisa print",
    "Komputer mati total",
    "Lupa password SIMRS",
    "Internet lambat",
];

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const sendMessage = async (messageText: string) => {
        if (!messageText.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: messageText,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch("/api/ai/ticket-assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: messageText }),
            });

            const data = await response.json();

            if (data.success) {
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: data.response,
                    relatedTickets: data.relevantTickets,
                };
                setMessages((prev) => [...prev, assistantMessage]);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "Maaf, terjadi kesalahan. Silakan coba lagi.",
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110",
                    isOpen
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground animate-pulse hover:animate-none"
                )}
            >
                {isOpen ? (
                    <X className="h-6 w-6" />
                ) : (
                    <MessageCircle className="h-6 w-6" />
                )}
            </button>

            {/* Chat Panel */}
            <div
                className={cn(
                    "fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border bg-card shadow-2xl transition-all duration-300",
                    isOpen
                        ? "translate-y-0 opacity-100 scale-100"
                        : "translate-y-4 opacity-0 scale-95 pointer-events-none"
                )}
            >
                {/* Header */}
                <div className="flex items-center gap-3 border-b bg-primary px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20">
                        <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-primary-foreground">
                            AI Assistant
                        </h3>
                        <p className="text-xs text-primary-foreground/70">
                            Bantuan troubleshooting IT
                        </p>
                    </div>
                    <Sparkles className="h-5 w-5 text-primary-foreground/50" />
                </div>

                {/* Messages */}
                <div className="h-[350px] overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center space-y-4">
                            <div className="flex justify-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                                    <Bot className="h-8 w-8 text-primary" />
                                </div>
                            </div>
                            <div>
                                <p className="font-medium">
                                    Halo! Saya AI Assistant 👋
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Saya bisa membantu troubleshooting berdasarkan riwayat tiket
                                </p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">
                                    Coba tanyakan:
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {suggestedQuestions.map((q) => (
                                        <Button
                                            key={q}
                                            variant="outline"
                                            size="sm"
                                            className="text-xs h-7"
                                            onClick={() => sendMessage(q)}
                                        >
                                            {q}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={cn(
                                "flex gap-2",
                                message.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {message.role === "assistant" && (
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                                    <Bot className="h-4 w-4 text-primary-foreground" />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "rounded-2xl px-4 py-2 max-w-[85%]",
                                    message.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted"
                                )}
                            >
                                <p className="text-sm whitespace-pre-wrap">
                                    {message.content}
                                </p>
                                {message.relatedTickets && message.relatedTickets.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-border/50">
                                        <p className="text-xs text-muted-foreground mb-1">
                                            Referensi tiket:
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {message.relatedTickets.map((t) => (
                                                <Badge
                                                    key={t.id}
                                                    variant="secondary"
                                                    className="text-xs"
                                                >
                                                    {t.category}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {message.role === "user" && (
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                                    <User className="h-4 w-4" />
                                </div>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                                <Bot className="h-4 w-4 text-primary-foreground" />
                            </div>
                            <div className="rounded-2xl bg-muted px-4 py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="border-t p-3">
                    <div className="flex gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ketik masalah disini..."
                            disabled={isLoading}
                            className="flex-1"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={!input.trim() || isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </>
    );
}
