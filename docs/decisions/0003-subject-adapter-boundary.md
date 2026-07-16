# 0003: Subject adapter boundary

Status: Accepted

Subjects provide knowledge, activities, and optional extensions through a
subject adapter. The learning engine must never import a concrete subject.

Registering a new subject should require composition-root work only, not changes
inside the core engine.
