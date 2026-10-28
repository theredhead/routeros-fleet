import { Component, input, output } from '@angular/core';
import { UIButton, UIIcon, UIIcons, UITooltip } from '@theredhead/lucid-kit';

/** Standard overview actions: details, confirmed deletion, and optional duplication. */
@Component({
  selector: 'app-object-actions',
  imports: [UIButton, UIIcon, UITooltip],
  templateUrl: './object-actions.component.html',
})
export class ObjectActionsComponent {
  readonly name = input.required<string>();
  readonly disabled = input(false);
  readonly canDelete = input(true);
  readonly canDuplicate = input(false);
  readonly edit = output<void>();
  readonly remove = output<void>();
  readonly duplicate = output<void>();
  readonly pencil = UIIcons.Lucide.Cursors.Pencil;
  readonly trash = UIIcons.Lucide.Files.Trash2;
  readonly copy = UIIcons.Lucide.Text.Copy;
}
