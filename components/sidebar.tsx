"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useContext,
} from "react";
import { usePathname } from "next/navigation";
import SessionId from "./session-id";
import { Pin } from "lucide-react";
import { useRouter } from "next/navigation";
import { CommandMenu } from "./command-menu";
import { SidebarContent } from "./sidebar-content";
import { SearchBar } from "./search";
import { groupNotesByCategory, sortGroupedNotes } from "@/lib/note-utils";
import { createClient } from "@/utils/supabase/client";
import { Note } from "@/lib/types";
import { toast } from "./ui/use-toast";
import { SessionNotesContext } from "@/app/notes/session-notes";
import { Nav } from "./nav";
import { useTheme } from "next-themes";
import { ScrollArea } from "./ui/scroll-area";

const labels = {
  pinned: (
    <>
      <Pin className="inline-block w-4 h-4 mr-1" /> Pinned
    </>
  ),
  today: "Today",
  yesterday: "Yesterday",
  "7": "Previous 7 Days",
  "30": "Previous 30 Days",
  older: "Older",
};

const categoryOrder = ["pinned", "today", "yesterday", "7", "30", "older"];

export default function Sidebar({
  notes: publicNotes,
  onNoteSelect,
  isMobile,
}: {
  notes: any[] | null | undefined;
  onNoteSelect: (note: any) => void;
  isMobile: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedNoteSlug, setSelectedNoteSlug] = useState<string | null>(null);
  const [pinnedNotes, setPinnedNotes] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [localSearchResults, setLocalSearchResults] = useState<any[] | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [groupedNotes, setGroupedNotes] = useState<any>({});
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [openSwipeItemSlug, setOpenSwipeItemSlug] = useState<string | null>(null);
  const [highlightedNote, setHighlightedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const commandMenuRef = useRef<{ setOpen: (open: boolean) => void } | null>(null);
  const selectedNoteRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  const { notes: sessionNotes, sessionId, setSessionId, refreshSessionNotes } =
    useContext(SessionNotesContext);

 const notes = useMemo(
  () => [ ...(publicNotes || []), ...(sessionNotes || []) ],
  [publicNotes, sessionNotes]
);

  useEffect(() => {
    if (pathname) {
      const slug = pathname.split("/").pop();
      setSelectedNoteSlug(slug || null);
    }
  }, [pathname]);

  useEffect(() => {
    if (selectedNoteSlug) {
      const note = notes.find((note) => note.slug === selectedNoteSlug);
      setSelectedNote(note || null);
    } else {
      setSelectedNote(null);
    }
  }, [selectedNoteSlug, notes]);

  useEffect(() => {
    const storedPinnedNotes = localStorage.getItem("pinnedNotes");
    if (storedPinnedNotes) {
      setPinnedNotes(new Set(JSON.parse(storedPinnedNotes)));
    } else {
      const initialPinnedNotes = new Set(
        notes
          .filter(
            (note) =>
              note.slug === "about-me" ||
              note.slug === "quick-links" ||
              note.session_id === sessionId
          )
          .map((note) => note.slug)
      );
      setPinnedNotes(initialPinnedNotes);
      localStorage.setItem(
        "pinnedNotes",
        JSON.stringify(Array.from(initialPinnedNotes))
      );
    }
  }, [notes, sessionId]);

  useEffect(() => {
    const userSpecificNotes = notes.filter(
      (note) => note.public || note.session_id === sessionId
    );
    const grouped = groupNotesByCategory(userSpecificNotes, pinnedNotes);
    sortGroupedNotes(grouped);
    setGroupedNotes(grouped);
  }, [notes, sessionId, pinnedNotes]);

  useEffect(() => {
    if (localSearchResults && localSearchResults.length > 0) {
      setHighlightedNote(localSearchResults[highlightedIndex]);
    } else {
      setHighlightedNote(selectedNote);
    }
  }, [localSearchResults, highlightedIndex, selectedNote]);

  const clearSearch = useCallback(() => {
    setLocalSearchResults(null);
    setSearchQuery("");
    setHighlightedIndex(0);
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
  }, []);

  const flattenedNotes = useCallback(() => {
    return categoryOrder.flatMap((category) =>
      groupedNotes[category] ? groupedNotes[category] : []
    );
  }, [groupedNotes]);

  const navigateNotes = useCallback(
    (direction: "up" | "down") => {
      if (!localSearchResults) {
        const flattened = flattenedNotes();
        const currentIndex = flattened.findIndex(
          (note) => note.slug === selectedNoteSlug
        );

        let nextIndex;
        if (direction === "up") {
          nextIndex =
            currentIndex > 0 ? currentIndex - 1 : flattened.length - 1;
        } else {
          nextIndex =
            currentIndex < flattened.length - 1 ? currentIndex + 1 : 0;
        }

        const nextNote = flattened[nextIndex];

        if (nextNote) {
          router.push(`/notes/${nextNote.slug}`);
          setTimeout(() => {
            const selectedElement = document.querySelector(
              `[data-note-slug="${nextNote.slug}"]`
            );
            if (selectedElement) {
              selectedElement.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
              });
            }
          }, 100);
        }
      }
    },
    [flattenedNotes, selectedNoteSlug, router, localSearchResults]
  );

  const handlePinToggle = useCallback(
    (slug: string) => {
      let isPinning = false;
      setPinnedNotes((prev) => {
        const newPinned = new Set(prev);
        isPinning = !newPinned.has(slug);
        if (isPinning) {
          newPinned.add(slug);
        } else {
          newPinned.delete(slug);
        }
        localStorage.setItem(
          "pinnedNotes",
          JSON.stringify(Array.from(newPinned))
        );
        return newPinned;
      });

      clearSearch();

      if (!isMobile) {
        router.push(`/notes/${slug}`);
      }

      toast({
        description: isPinning ? "Note pinned" : "Note unpinned",
      });
    },
    [router, isMobile, clearSearch]
  );

  const handleNoteDelete = useCallback(
    async (noteToDelete: Note) => {
      if (noteToDelete.public) {
        toast({
          description: "Oops! You can't delete public notes",
        });
        return;
      }

      try {
        if (noteToDelete.id && sessionId) {
          await supabase.rpc("delete_note", {
            uuid_arg: noteToDelete.id,
            session_arg: sessionId,
          });
        }

        setGroupedNotes((prevGroupedNotes: Record<string, Note[]>) => {
          const newGroupedNotes = { ...prevGroupedNotes };
          for (const category in newGroupedNotes) {
            newGroupedNotes[category] = newGroupedNotes[category].filter(
              (note: Note) => note.slug !== noteToDelete.slug
            );
          }
          return newGroupedNotes;
        });

        const allNotes = flattenedNotes();
        const deletedNoteIndex = allNotes.findIndex(
          (note) => note.slug === noteToDelete.slug
        );

        let nextNote;
        if (deletedNoteIndex === 0) {
          nextNote = allNotes[1];
        } else {
          nextNote = allNotes[deletedNoteIndex - 1];
        }

        if (!isMobile) {
          router.push(nextNote ? `/notes/${nextNote.slug}` : "/notes/about-me");
        }

        clearSearch();
        refreshSessionNotes();
        router.refresh();

        toast({
          description: "Note deleted",
        });
      } catch (error) {
        console.error("Error deleting note:", error);
      }
    },
    [
      supabase,
      sessionId,
      flattenedNotes,
      isMobile,
      clearSearch,
      refreshSessionNotes,
      router,
    ]
  );

  const { setTheme, theme } = useTheme();

  const handleNoteSelect = useCallback(
    (note: any) => {
      onNoteSelect(note);
      if (!isMobile) {
        router.push(`/notes/${note.slug}`);
      }
      clearSearch();
    },
    [clearSearch, onNoteSelect, isMobile, router]
  );

  return (
    <div
      className={`${
        isMobile
          ? "w-full max-w-full"
          : "w-[320px] border-r border-muted-foreground/20"
      } h-dvh flex flex-col dark:bg-muted`}
    >
      <div className={`${isMobile ? "w-full" : "w-[320px]"}`}>
        <Nav
          addNewPinnedNote={handlePinToggle}
          clearSearch={clearSearch}
          setSelectedNoteSlug={setSelectedNoteSlug}
          isMobile={isMobile}
          isScrolled={isScrolled}
        />
      </div>
      <ScrollArea className="flex-1">
        <div ref={scrollViewportRef} className="flex flex-col w-full">
          <SessionId setSessionId={setSessionId} />
          <CommandMenu
            notes={notes}
            sessionId={sessionId}
            addNewPinnedNote={handlePinToggle}
            navigateNotes={navigateNotes}
            togglePinned={handlePinToggle}
            deleteNote={handleNoteDelete}
            highlightedNote={highlightedNote}
            setSelectedNoteSlug={setSelectedNoteSlug}
            isMobile={isMobile}
          />
          <div className={`${isMobile ? "w-full" : "w-[320px]"} px-2`}>
            <SearchBar
              notes={notes}
              onSearchResults={setLocalSearchResults}
              sessionId={sessionId}
              inputRef={searchInputRef}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setHighlightedIndex={setHighlightedIndex}
              clearSearch={clearSearch}
            />
            <SidebarContent
              groupedNotes={groupedNotes}
              selectedNoteSlug={selectedNoteSlug}
              onNoteSelect={handleNoteSelect}
              sessionId={sessionId}
              handlePinToggle={handlePinToggle}
              pinnedNotes={pinnedNotes}
              localSearchResults={localSearchResults}
              highlightedIndex={highlightedIndex}
              categoryOrder={categoryOrder}
              labels={labels}
              handleNoteDelete={handleNoteDelete}
              openSwipeItemSlug={openSwipeItemSlug}
              setOpenSwipeItemSlug={setOpenSwipeItemSlug}
              clearSearch={clearSearch}
              setSelectedNoteSlug={setSelectedNoteSlug}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
