import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Headphones, Send, Bot, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Support() {
  const [message, setMessage] = useState("");
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: tickets = [] } = useQuery({
    queryKey: ["my-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["ticket-messages", activeTicketId],
    queryFn: async () => {
      if (!activeTicketId) return [];
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", activeTicketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!activeTicketId,
  });

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      const { data, error } = await supabase.functions.invoke("ai-support", {
        body: { message: msg, ticket_id: activeTicketId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setActiveTicketId(data.ticket_id);
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["my-support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", data.ticket_id] });
      if (data.needs_escalation) {
        toast.info("Your question has been escalated to our team.");
      }
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to send message");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Headphones className="h-6 w-6 text-primary" /> Help & Support
        </h1>
        <p className="text-muted-foreground">Ask our AI assistant or browse your past tickets</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ticket list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            <Button
              variant={!activeTicketId ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => setActiveTicketId(null)}
            >
              + New Conversation
            </Button>
            {tickets.map((t: any) => (
              <button
                key={t.id}
                onClick={() => setActiveTicketId(t.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors text-sm ${
                  activeTicketId === t.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate max-w-[150px]">{t.subject}</span>
                  <Badge variant={t.status === "ai_resolved" ? "secondary" : t.status === "escalated" ? "destructive" : "default"} className="text-[10px]">
                    {t.status?.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{format(new Date(t.created_at), "MMM d, HH:mm")}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Chat area */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4 flex flex-col h-[550px]">
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {!activeTicketId && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Bot className="h-12 w-12 mb-2 opacity-40" />
                  <p className="text-sm">Ask anything about your claims, settlements, or payouts.</p>
                </div>
              )}
              {messages.map((m: any) => (
                <div key={m.id} className={`flex gap-2 ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                  {m.sender_type !== "user" && (
                    <div className="rounded-full bg-primary/10 p-1.5 h-7 w-7 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`rounded-xl px-4 py-2.5 max-w-[80%] text-sm ${
                    m.sender_type === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}>
                    {m.message}
                  </div>
                  {m.sender_type === "user" && (
                    <div className="rounded-full bg-muted p-1.5 h-7 w-7 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Textarea
                placeholder="Ask about your claim status, deadlines, payouts..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (message.trim()) sendMutation.mutate(message.trim());
                  }
                }}
                className="min-h-[44px] max-h-[100px]"
              />
              <Button
                onClick={() => message.trim() && sendMutation.mutate(message.trim())}
                disabled={sendMutation.isPending || !message.trim()}
                size="icon"
                className="shrink-0"
              >
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
