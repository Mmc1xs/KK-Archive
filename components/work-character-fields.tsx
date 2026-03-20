"use client";

import { useMemo, useState } from "react";
import { TagAutocomplete, type SelectedAutocompleteTag } from "@/components/tag-autocomplete";

type TagOption = {
  id: number;
  name: string;
  slug: string;
};

type WorkCharacterFieldsProps = {
  initialWorkTags?: TagOption[];
  initialCharacterTags?: TagOption[];
};

export function WorkCharacterFields({
  initialWorkTags = [],
  initialCharacterTags = []
}: WorkCharacterFieldsProps) {
  const [selectedWorkTags, setSelectedWorkTags] = useState<SelectedAutocompleteTag[]>(
    initialWorkTags.slice(0, 1).map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug }))
  );

  const selectedWorkId = useMemo(() => {
    const work = selectedWorkTags[0];
    return typeof work?.id === "number" ? work.id : undefined;
  }, [selectedWorkTags]);

  const selectedWorkIdentity = useMemo(() => {
    const work = selectedWorkTags[0];
    if (!work) {
      return "none";
    }
    if (typeof work.id === "number") {
      return `id:${work.id}`;
    }
    return `new:${work.name.toLowerCase()}`;
  }, [selectedWorkTags]);

  const initialWorkIdentity = useMemo(() => {
    const work = initialWorkTags[0];
    if (!work) {
      return "none";
    }
    return `id:${work.id}`;
  }, [initialWorkTags]);

  const hasWorkSelected = selectedWorkTags.length > 0;
  const initialCharactersForCurrentWork = selectedWorkIdentity === initialWorkIdentity ? initialCharacterTags : [];

  return (
    <>
      <TagAutocomplete
        label="Work"
        idName="workTagIds"
        newName="workTagNames"
        tagType="WORK"
        initialSelectedTags={initialWorkTags}
        multiple={false}
        required
        placeholder="Search or create works"
        onSelectedTagsChange={setSelectedWorkTags}
      />
      <TagAutocomplete
        key={`character-${selectedWorkIdentity}`}
        label="Character"
        idName="characterTagIds"
        newName="characterTagNames"
        tagType="CHARACTER"
        initialSelectedTags={initialCharactersForCurrentWork}
        multiple={false}
        required
        placeholder={hasWorkSelected ? "Search or create characters" : "Select work first"}
        contextWorkTagId={selectedWorkId}
        disabled={!hasWorkSelected}
      />
    </>
  );
}
