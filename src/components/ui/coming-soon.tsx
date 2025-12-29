"use client";

import { Construction, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

interface ComingSoonProps {
    title?: string;
    description?: string;
    estimatedDate?: string;
}

export function ComingSoon({
    title = "Coming Soon",
    description = "This feature is currently under development and will be available soon.",
    estimatedDate,
}: ComingSoonProps) {
    const router = useRouter();

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="max-w-md text-center border-dashed">
                <CardHeader className="space-y-4">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Construction className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">{title}</CardTitle>
                    <CardDescription className="text-base">
                        {description}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {estimatedDate && (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>Estimated: {estimatedDate}</span>
                        </div>
                    )}
                    <Button variant="outline" onClick={() => router.back()} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Go Back
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
