import { Component, ContextManager, Observable, Event } from "@zcomponent/core";
import { useOverlay } from "@zcomponent/core";

// Import external HTML and CSS files
const destinationHTMLUrl = new URL('./destination.html', import.meta.url);
const destinationCSSUrl = new URL('./destination.css', import.meta.url);

import "./destination.css"; // ✅ CSS stays

interface ConstructorProps {
  /**
   * @zui
   * @zdefault true
   */
  showSearchBar?: boolean;

  /**
   * @zui
   * @zdefault true
   */
  showCategories?: boolean;

  /**
   * @zui
   * @zdefault "Search destinations..."
   */
  searchPlaceholder?: string;
}

interface Destination {
  id: string;
  name: string | (() => string); // 👈 IMPORTANT
  category: string;
  description?: string;
  position: () => [number, number, number];
}



/**
 * @zcomponent
 */
export default class DestinationSearchUI extends Component<ConstructorProps> {
  private _categoryIcons: Record<string, string> = {
    /* 🔘 All */
    All: `
    <svg class="chip-icon" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"/>
    </svg>
    `,

    /* 🏢 Office / Front Office / IIPC */
    Office: `
    <svg class="chip-icon" viewBox="0 0 24 24">
      <path d="M4 20V6l8-3 8 3v14"
      fill="none"
      stroke="currentColor"
      stroke-width="2"/>
      <path d="M9 20v-6h6v6"
      fill="none"
      stroke="currentColor"
      stroke-width="2"/>
    </svg>
    `,

    /* 🚻 Washroom */
    washroom: `
    <svg class="chip-icon" viewBox="0 0 24 24">
      <path d="M12 2c4 6 6 9 6 12a6 6 0 1 1-12 0c0-3 2-6 6-12z"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"/>
    </svg>
    `,

    /* 🧳 Travel Desk */
    Travles: `
    <svg class="chip-icon" viewBox="0 0 24 24">
      <rect x="4" y="6" width="16" height="12" rx="2"
      fill="none"
      stroke="currentColor"
      stroke-width="2"/>
      <path d="M8 10h8M8 14h5"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"/>
    </svg>
    `,

    /* 🎭 Auditorium */
    Auditorium: `
    <svg class="chip-icon" viewBox="0 0 24 24">
      <path d="M4 16c4-4 12-4 16 0"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"/>
      <path d="M6 10h12"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"/>
    </svg>
    `,
    /* 🎓 Internship / Training */
    Internship: `
    <svg class="chip-icon" viewBox="0 0 24 24">
    <!-- Graduation cap -->
    <path d="M12 4L2 9l10 5 10-5-10-5z"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"/>

    <!-- Cap base -->
    <path d="M6 11v4c0 2 12 2 12 0v-4"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"/>

    <!-- Tassel -->
    <path d="M12 14v4"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"/>
    </svg>
    `,

    /* 🍽️ Food Court */
    Food: `
    <svg class="chip-icon" viewBox="0 0 24 24">
      <path d="M6 3v18M18 3v18"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"/>
      <path d="M10 3v6M14 3v6"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"/>
    </svg>
    `,
  };

  public searchQuery = new Observable<string>("");
  public selectedCategory = new Observable<string>("");
  public selectedDestination = new Observable<string>("");

  public onDestinationSelected = new Event<[destination: Destination]>();
  public onNavigateToDestination = new Event<[destinationId: string, destinationName: string]>();
  public onSearchChanged = new Event<[query: string]>();
private _onSelectedUserChanged = () => {
  this._filterDestinations();
};

  private _overlay: HTMLDivElement | null = null;
  private _searchInput: HTMLInputElement | null = null;
  private _destinationsContainer: HTMLDivElement | null = null;
  private _categoriesContainer: HTMLDivElement | null = null;
  private _searchIcon: HTMLElement | null = null;
  private _positionMenu: HTMLElement | null = null;
  private _longPressTimer: number | null = null;
  private _isShowingMenu = false;
  private _iconPosition: 'left' | 'right' = 'right';
  private _gestureState: 'idle' | 'tap_pending' | 'long_press_detected' | 'tap_cancelled' = 'idle';
  private _touchStartTime = 0;
  private _htmlTemplate = '';

  private _getDestinationSVG(destinationId: string): string {
    const icons: Record<string, string> = {

      /* 🏢 Front Office — Info / Help Desk */
      "1e4a4fec00c1480d9d130a2cbf08c959": `
      <svg viewBox="0 0 24 24" class="destination-icon-svg">
        <circle cx="12" cy="12" r="9"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"/>
        <path d="M12 10v5M12 7h.01"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"/>
      </svg>
      `,

      /* 🚻 Washroom */
      "306ce60fc0a34f08b24d781bdcfee99f": `
      <svg viewBox="0 0 24 24" class="destination-icon-svg">
        <path d="M12 2c4 6 6 9 6 12a6 6 0 1 1-12 0c0-3 2-6 6-12z"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"/>
      </svg>
      `,

      /* 🧳 Travel Desk — Services */
      "6e8c4e3bd5a74e708cedb78f8cba6135": `
      <svg viewBox="0 0 24 24" class="destination-icon-svg">
        <rect x="4" y="6" width="16" height="12" rx="2"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"/>
        <path d="M8 10h8M8 14h5"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"/>
      </svg>
      `,

      /* 🏢 IIPC — Office / Training */
      "ddb59d9a1b724e099a1b2816cd9409b4": `
      <svg viewBox="0 0 24 24" class="destination-icon-svg">
        <path d="M4 20V6l8-3 8 3v14"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"/>
        <path d="M9 20v-6h6v6"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"/>
      </svg>
      `,

      /* 🎭 Open Auditorium */
      "505bf4e58d9940be88c1ae56175f23c4": `
      <svg viewBox="0 0 24 24" class="destination-icon-svg">
        <path d="M4 16c4-4 12-4 16 0"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"/>
        <path d="M6 10h12"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"/>
      </svg>
      `,

      /* 🎭 Auditorium E1 */
      "d42b4c49888a4dae9081f2cafc077e74": `
      <svg viewBox="0 0 24 24" class="destination-icon-svg">
        <path d="M4 16c4-4 12-4 16 0"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"/>
        <path d="M8 10h8"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"/>
      </svg>
      `,

      /* 🎭 Auditorium E2 */
      "7b1950ad62374494bcf2082e2bd3e50e": `
      <svg viewBox="0 0 24 24" class="destination-icon-svg">
        <path d="M4 16c4-4 12-4 16 0"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"/>
        <path d="M10 10h4"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"/>
      </svg>
      `,

      /* 🍽️ Food Court */
      "be41459d90394c3694ed771a9ce689b5": `
      <svg viewBox="0 0 24 24" class="destination-icon-svg">
        <path d="M6 3v18M18 3v18"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"/>
        <path d="M10 3v6M14 3v6"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"/>
      </svg>
      `,
    };

    return icons[destinationId] || `
    <svg viewBox="0 0 24 24" class="destination-icon-svg">
      <circle cx="12" cy="12" r="9"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"/>
    </svg>
    `;
  }

  private _registerDestinationObject(): void {
    const zcomp = this.getZComponentInstance();
    const destinationNode = zcomp.nodes.Destination as any;

    if (destinationNode?.three) {
      (window as any).RuntimeDestinationMover.register(destinationNode.three);
    } else {
      console.warn("⚠️ Could not register Destination object");
    }
  }

  private _destinations: Destination[] = [
    {
      id: "7b155ce59cc44f4699fe21d6860a84a4",
      name: "Water",
      category: "Water",
      description: "Main help desk for visitor assistance, campus information, admissions guidance, and general enquiries.",
       position: () => [-2.30, -0.35, 0.91],
    },
    {
      id: "213dceaa5a164dfcb87aa16c954f721a",
      name: "Auditorium",
      category: "Auditorium",
      description: "Clean and accessible restroom facility available for students, staff, and visitors.",
       position: () => [1.71,-0.36,3.69], // ✅ STATIC
    },
    {
      id: "5389fd36a79640a0a1bd31f8c8bcd31e",
name: () => {
  const user = window.selectedUser;
  

  if (!user) {
    return "No user connected";
  }

  // ✅ Always show email (name is optional)
  return user.email || "Connected User";
},

      category: "Friend",
      description: "Live location of connected user",
      position: () => [
        window.selectedX ?? 0,
        window.selectedY ?? 0,
        window.selectedZ ?? 0,
      ],
    },
  ];

  private _filteredDestinations: Destination[] = [];
  private _categories: string[] = [];

  constructor(contextManager: ContextManager, constructorProps: ConstructorProps) {
    super(contextManager, constructorProps);

    this._loadSavedPosition();
    this._initializeData();

    // ✅ IMPORTANT FIX: wait for HTML to load
    this._loadExternalAssets().then(() => {
      this._createUI();
      this._setupEventListeners();
    });
    // 🔁 Refresh destinations when selected user changes
window.addEventListener(
  "selected-user-changed",
  this._onSelectedUserChanged
);


  }

  protected start() {
    // super.start();
    this._setNodePositions(); // Run here for better timing (after scene init)
  }

  private _initializeData(): void {
    this._categories = [...new Set(this._destinations.map(d => d.category))];
    this._filteredDestinations = [...this._destinations];
  }

  private _setNodePositions(): void {
    try {
      const zcomp = this.getZComponentInstance();

      // Map your destination data to node names (adjust if node names differ)
      const nodeMap: { [key: string]: string } = {
        "7b155ce59cc44f4699fe21d6860a84a4": "Water0",    // Matches your Office ID
        "213dceaa5a164dfcb87aa16c954f721a": "Auditorium0",      // Matches your Sofa ID
        "5389fd36a79640a0a1bd31f8c8bcd31e": "Destination0" 
              };

      this._destinations.forEach(dest => {
        const nodeName = nodeMap[dest.id];
        if (!nodeName) {
          console.warn(`No node mapping found for destination ID: ${dest.id}`);
          return;
        }

        const node = zcomp.nodes[nodeName] as any;
        if (node) {
          node.position(dest.position); // Use functional setter for observables
          node.three?.updateMatrixWorld(true); // Force Three.js hierarchy update (per manual)
          console.log(`✅ Position set for "${nodeName}":`, dest.position);
        } else {
          console.warn(`Node "${nodeName}" not found in hierarchy for ID: ${dest.id}`);
        }
      });
    } catch (error) {
      console.error('Error setting node positions:', error);
    }
  }

  private async _loadExternalAssets(): Promise<void> {
    try {
      // Load CSS dynamically (kept as-is)
      const cssResponse = await fetch(destinationCSSUrl);
      const cssText = await cssResponse.text();
      const styleElement = document.createElement('style');
      styleElement.textContent = cssText;
      document.head.appendChild(styleElement);

      // Load HTML template
      const htmlResponse = await fetch(destinationHTMLUrl);
      this._htmlTemplate = await htmlResponse.text();
    } catch (error) {
      console.warn('Could not load external destination assets:', error);
    }
  }

  private _createUI(): void {
    const overlay = useOverlay(this.contextManager);

    this.register(overlay, (overlayElement) => {
      if (!overlayElement) return;
      this._overlay = overlayElement;
      this._createSearchInterface();
      // ← ADD THIS LINE: Create the People Search UI on the same overlay
      new PeopleSearchUI(this.contextManager);
    });
  }

  private _createSearchInterface(): void {
    if (!this._overlay || !this._htmlTemplate) return;

    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = this._htmlTemplate;

    const searchIcon = tempContainer.querySelector('#floating-search-icon');
    const searchContainer = tempContainer.querySelector('#expandable-search-container');

    if (searchIcon) {
      this._searchIcon = searchIcon as HTMLElement;
      this._updateIconPosition();
      this._setupIconInteractions(this._searchIcon);
      this._overlay.appendChild(this._searchIcon);
    }

    if (searchContainer) {
      this._overlay.appendChild(searchContainer);
      this._setupSearchContainer();
    }
  }

  private _setupSearchContainer(): void {
    const container = this._overlay?.querySelector('#expandable-search-container') as HTMLElement;
    if (!container) return;
    
    // Setup search input
    this._searchInput = container.querySelector('.search-input') as HTMLInputElement;
    if (this._searchInput) {
      this._searchInput.placeholder = this.constructorProps?.searchPlaceholder ?? "Search destination…";
    }
    
    // Setup categories container
    this._categoriesContainer = container.querySelector('.categories-container') as HTMLDivElement;
    
    // Setup destinations container
    this._destinationsContainer = container.querySelector('.destinations-container') as HTMLDivElement;
    
    // Setup close button
    const closeButton = container.querySelector('.close-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this._toggleSearchContainer(false);
      });
    }
    
    // Initialize content
    if (this.constructorProps?.showCategories !== false) {
      this._createCategoriesSection();
    }
    
    this._updateDestinationsList();
    this._updateSearchContainerPosition();
  }

  
  private _toggleSearchContainer(show: boolean): void {
    const container = this._overlay?.querySelector('#expandable-search-container') as HTMLElement;
    const icon = this._overlay?.querySelector('#floating-search-icon') as HTMLElement;
    
    if (!container || !icon) return;
    
    if (show) {
      // Prepare container for smooth fade-in with slide-up
      container.style.display = 'block';
      
      // Force reflow to ensure initial state is applied
      container.offsetHeight;
      
      // Smooth fade-in with slight slide-up over 250ms
      requestAnimationFrame(() => {
        container.style.pointerEvents = 'auto';
        container.style.opacity = '1';
        container.style.transform = 'scale(1) translateY(0)';
      });
      
      // Hide icon more smoothly with gentle fade
      icon.style.opacity = '0.15';
      icon.style.transform = 'scale(0.82)';
      icon.style.pointerEvents = 'none';
      
      // Don't auto-focus to prevent unwanted keyboard opening
      // Users must explicitly tap the input field to open keyboard
    } else {
      // Smooth fade-out with slide-down animation
      container.style.opacity = '0';
      container.style.transform = 'scale(0.92) translateY(25px)';
      container.style.pointerEvents = 'none';
      
      // Clear search input focus
      if (this._searchInput) {
        this._searchInput.blur();
      }
      
      // Show icon after container begins hiding
      setTimeout(() => {
        icon.style.opacity = '1';
        icon.style.transform = 'scale(1)';
        icon.style.pointerEvents = 'auto';
      }, 140);
    }
    
    // Add click outside to close functionality
    if (show) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!container.contains(target) && !icon.contains(target)) {
          this._toggleSearchContainer(false);
          document.removeEventListener('click', handleClickOutside);
        }
      };
      
      // Add listener after a short delay to prevent immediate closure
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);
    }
  }
  
private _createCategoriesSection(): void {
  if (!this._categoriesContainer) return;

  this._categoriesContainer.innerHTML = '';

  // ALL chip
  this._createCategoryChip('', 'All');

  // Dynamic chips from destinations
  this._categories.forEach(category => {
    this._createCategoryChip(category, category);
  });
}

  private _createCategoryButton(categoryId: string, label: string, container: HTMLElement): void {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = 'category-button';
    
    // Set initial state
    if (categoryId === this.selectedCategory.value) {
      button.classList.add('active');
    }
    
    button.addEventListener('click', () => {
      this.selectedCategory.value = categoryId;
      this._updateCategoryButtons();
      this._filterDestinations();
    });
    
    container.appendChild(button);
  }
private _createCategoryChip(categoryId: string, label: string): void {
  if (!this._categoriesContainer) return;

  const button = document.createElement('button');
  button.className = 'category-chip';

  const icon =
    this._categoryIcons[label] ||
    this._categoryIcons['All'];

  button.innerHTML = `
    ${icon}
    <span>${label}</span>
  `;

  if (
    (categoryId === '' && this.selectedCategory.value === '') ||
    categoryId === this.selectedCategory.value
  ) {
    button.classList.add('active');
  }

  button.addEventListener('click', () => {
    this.selectedCategory.value = categoryId;
    this._updateCategoryButtons();
    this._filterDestinations();
  });

  this._categoriesContainer.appendChild(button);
}

private _updateCategoryButtons(): void {
  if (!this._categoriesContainer) return;

  const buttons = this._categoriesContainer.querySelectorAll('.category-chip');

  buttons.forEach(button => {
    const label = button.textContent?.trim() || '';

    const isActive =
      (label === 'All' && this.selectedCategory.value === '') ||
      label === this.selectedCategory.value;

    button.classList.toggle('active', isActive);
  });

}

  private _createDestinationsList(container: HTMLElement): void {
    this._updateDestinationsList();
  }
  
  private _updateDestinationsList(): void {
    if (!this._destinationsContainer) return;
    
    this._destinationsContainer.innerHTML = '';
    
    if (this._filteredDestinations.length === 0) {
      const noResults = document.createElement('div');
      noResults.textContent = 'No destinations found';
      noResults.className = 'no-results';
      this._destinationsContainer.appendChild(noResults);
      return;
    }
    
    this._filteredDestinations.forEach(destination => {
      this._createDestinationCard(destination);
    });
  }
  private _createDestinationCard(destination: Destination): void {
  const card = document.createElement('div');
  card.className = 'destination-card';
  card.setAttribute('data-destination', destination.id);

  card.innerHTML = `
    <div class="destination-icon-wrapper">
      ${this._getDestinationSVG(destination.id)}
    </div>

    <div class="destination-info">
     <h3 class="destination-name">
  ${this._getDestinationName(destination)}
</h3>

      <div class="destination-meta">
        <span class="destination-category">${destination.category}</span>
      </div>
      ${destination.description ? `
        <p class="destination-description">${destination.description}</p>
      ` : ''}
    </div>
  `;

  card.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    this.selectedDestination.value = destination.id;
    this.onDestinationSelected.emit(destination);
    this.onNavigateToDestination.emit(destination.id,typeof destination.name === "function"
  ? destination.name()
  : destination.name
);

    this._activateNavigationLayer(destination.id);

    setTimeout(() => {
      this._toggleSearchContainer(false);
    }, 400);
  });

  this._destinationsContainer?.appendChild(card);
}
  
  private _highlightSelectedCard(selectedCard: HTMLElement): void {
    // Reset all cards
    const cards = this._destinationsContainer!.querySelectorAll('.destination-card');
    cards.forEach(card => {
      card.classList.remove('selected');
    });
    
    // Highlight selected
    selectedCard.classList.add('selected');
  }
  
  
private _activateNavigationLayer(destinationId: string): void {
  try {
    const zcomp = this.getZComponentInstance();

    /* ----------------------------------------------------
       1️⃣ FIND DESTINATION DATA (FROM UI LIST / DB)
    ---------------------------------------------------- */
    const destination = this._destinations.find(d => d.id === destinationId);
    if (!destination) {
      console.warn("❌ Destination data not found:", destinationId);
      return;
    }

    /* ----------------------------------------------------
       2️⃣ REGISTER REAL 3D DESTINATION OBJECT
    ---------------------------------------------------- */
    this._registerDestinationObject();

    /* ----------------------------------------------------
       3️⃣ MOVE DESTINATION TO DYNAMIC XYZ  ✅ (IMPORTANT)
    ---------------------------------------------------- */
const [x, y, z] = destination.position();
(window as any).RuntimeDestinationMover.moveTo(x, y, z);


    console.log("📍 Dynamic destination moved to:", x, y, z);

    /* ----------------------------------------------------
       4️⃣ ACTIVATE NAVIGATION LAYER / CLIP
    ---------------------------------------------------- */
    const poiLayer = zcomp.animation.layers.poi;

    const layerClipMap: { [key: string]: string } = {
      '7b155ce59cc44f4699fe21d6860a84a4': 'Water0',   // Office
      '213dceaa5a164dfcb87aa16c954f721a': 'Auditorium0',     // Sofa
      '5389fd36a79640a0a1bd31f8c8bcd31e': 'Destination0', 
    };

    const clipName = layerClipMap[destinationId];

    console.log(`🎯 Activating navigation: ${destinationId} → ${clipName}`);
    console.log(`📍 POI Layer exists:`, !!poiLayer);
    console.log(`🎬 Available clips:`, poiLayer?.clips ? Object.keys(poiLayer.clips) : []);

    if (clipName && poiLayer?.clips?.[clipName]) {
      poiLayer.clips[clipName].play();
      console.log(`✅ Navigation clip played: ${clipName}`);
    } else {
      console.warn("⚠️ Navigation clip not found for:", clipName);
    }

    /* ----------------------------------------------------
       5️⃣ ENABLE NAVIGATION ROUTE
    ---------------------------------------------------- */
    const navigationRoute = zcomp.nodes.NavigationRoute as any;
    if (navigationRoute?.visible) {
      navigationRoute.visible.value = true;
      console.log("🛣️ NavigationRoute enabled");
    }

    /* ----------------------------------------------------
       6️⃣ UPDATE DISTANCE CALCULATOR
    ---------------------------------------------------- */
    this._notifyDistanceCalculator(destinationId);

  } catch (error) {
    console.error("❌ Error activating navigation layer:", error);
    console.error("Stack trace:", (error as any)?.stack);
  }
}

  
  private _notifyDistanceCalculator(destinationId: string): void {
    try {
      const zcomp = this.getZComponentInstance();
      
      console.log(`🔍 Looking for Distance Calculator component...`);
      
      // Try accessing through nodes first
      let distanceCalculator = zcomp.nodes.DistanceCalculator as any;
      
      // If not found through nodes, try the global window reference
      if (!distanceCalculator) {
        distanceCalculator = (window as any).DistanceCalculator;
        console.log(`🌐 Trying global DistanceCalculator reference:`, !!distanceCalculator);
      }
      
      console.log(`Distance Calculator found:`, !!distanceCalculator);
      console.log(`setTarget method available:`, !!(distanceCalculator && typeof distanceCalculator.setTarget === 'function'));
      
      if (distanceCalculator && typeof distanceCalculator.setTarget === 'function') {
        const destination = this._destinations.find(d => d.id === destinationId);
        if (destination) {
          distanceCalculator.setTarget(destinationId);
          console.log(`✅ Distance Calculator activated for: ${destination.name}`);
        } else {
          console.error(`❌ Destination not found in _destinations array: ${destinationId}`);
        }
      } else {
        console.warn(`⚠️ Distance Calculator component not found or setTarget method missing`);
        console.log(`Available node names:`, Object.keys(zcomp.nodes));
        console.log(`Available entity types:`, Array.from(zcomp.entityByID.values()).map(e => (e as any).constructor?.name));
      }
    } catch (error) {
      console.error('❌ Error notifying Distance Calculator:', error);
    }
  }
  
  private _setupEventListeners(): void {
    // Search input
    if (this._searchInput) {
      this._searchInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        this.searchQuery.value = target.value;
        this.onSearchChanged.emit(target.value);
        this._filterDestinations();
      });
    }
    
    // Listen to observable changes
    this.register(this.searchQuery, () => {
      this._filterDestinations();
    });
    
    this.register(this.selectedCategory, () => {
      this._updateCategoryButtons();
      this._filterDestinations();
    });
  }
 private _getDestinationName(destination: Destination): string {
  return typeof destination.name === "function"
    ? destination.name()
    : destination.name;
}
 
private _filterDestinations(): void {
  const query = this.searchQuery.value.toLowerCase();
  const category = this.selectedCategory.value;

  this._filteredDestinations = this._destinations.filter(destination => {
    const name = this._getDestinationName(destination).toLowerCase();
    const description = destination.description?.toLowerCase() ?? "";
    const categoryText = destination.category.toLowerCase();

    const matchesSearch =
      !query ||
      name.includes(query) ||
      description.includes(query) ||
      categoryText.includes(query);

    const matchesCategory =
      !category || destination.category === category;

    return matchesSearch && matchesCategory;
  });

  this._updateDestinationsList();
}

  
  private _loadSavedPosition(): void {
    try {
      const savedPosition = localStorage.getItem('mattercraft-search-icon-position');
      if (savedPosition === 'left' || savedPosition === 'right') {
        this._iconPosition = savedPosition;
      }
    } catch (error) {
      console.warn('Could not load saved search icon position:', error);
    }
  }
  
  private _savePosition(): void {
    try {
      localStorage.setItem('mattercraft-search-icon-position', this._iconPosition);
    } catch (error) {
      console.warn('Could not save search icon position:', error);
    }
  }
  
  private _updateIconPosition(): void {
    if (!this._searchIcon) return;
    
    // Remove previous position classes
    this._searchIcon.classList.remove('position-left', 'position-right');
    // Add new position class
    this._searchIcon.classList.add(`position-${this._iconPosition}`);
  }
  
  private _setupIconInteractions(searchIcon: HTMLElement): void {
    // Handle touch start for mobile long press
    searchIcon.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._handleGestureStart();
    });
    
    // Handle touch end
    searchIcon.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._handleGestureEnd();
    });
    
    // Handle mouse down for desktop click-and-hold
    searchIcon.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left mouse button
        e.preventDefault();
        this._handleGestureStart();
      }
    });
    
    // Handle mouse up
    searchIcon.addEventListener('mouseup', (e) => {
      e.preventDefault();
      this._handleGestureEnd();
    });
    
    // Handle mouse leave to cancel any gesture
    searchIcon.addEventListener('mouseleave', () => {
      this._resetGestureState();
    });
    
    // Handle regular click - only if gesture allows it
    searchIcon.addEventListener('click', (e) => {
      e.preventDefault();
      // Click event is handled through gesture system now
    });
  }
  
  private _handleGestureStart(): void {
    this._touchStartTime = Date.now();
    this._gestureState = 'tap_pending';
    
    // Cancel any existing timer
    this._cancelLongPress();
    
    // Start long press timer
    this._longPressTimer = window.setTimeout(() => {
      if (this._gestureState === 'tap_pending') {
        this._gestureState = 'long_press_detected';
        this._showPositionMenu();
      }
    }, 600);
  }
  
  private _handleGestureEnd(): void {
    const touchDuration = Date.now() - this._touchStartTime;
    
    if (this._gestureState === 'tap_pending' && touchDuration < 600) {
      // Short tap - trigger search only if long press wasn't detected
      this._gestureState = 'idle';
      this._cancelLongPress();
      
      if (!this._isShowingMenu) {
        setTimeout(() => this._handleSearchIconClick(), 50);
      }
    } else if (this._gestureState === 'long_press_detected') {
      // Long press already handled, just reset state
      this._gestureState = 'idle';
      this._cancelLongPress();
    } else {
      // Reset state
      this._resetGestureState();
    }
  }
  
  private _resetGestureState(): void {
    this._gestureState = 'idle';
    this._cancelLongPress();
    this._touchStartTime = 0;
  }
  
  private _cancelLongPress(): void {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  }
  
  private _handleSearchIconClick(): void {
    // Add click feedback class
    if (!this._searchIcon) return;
    
    this._searchIcon.classList.add('clicked');
    
    setTimeout(() => {
      if (this._searchIcon) {
        this._searchIcon.classList.remove('clicked');
        this._toggleSearchContainer(true);
      }
    }, 120);
  }
  
  private _showPositionMenu(): void {
    if (this._isShowingMenu || !this._searchIcon || !this._overlay) return;
    
    this._isShowingMenu = true;
    
    // Create position menu
    const menu = document.createElement('div');
    menu.id = `position-menu-eb5ebab6-${Date.now()}`;
    menu.className = 'position-menu';
    this._positionMenu = menu;
    
    // Apply positioning classes
    menu.classList.add(`position-${this._iconPosition}`);
    
    // Create position buttons
    this._createPositionButton(menu, 'left', '← Left');
    this._createPositionButton(menu, 'right', 'Right →');
    
    this._overlay.appendChild(menu);
    
    // Animate in
    requestAnimationFrame(() => {
      menu.classList.add('visible');
    });
    
    // Visual feedback on icon
    this._searchIcon.classList.add('menu-active');
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      this._hidePositionMenu();
    }, 4000);
    
    // Click outside to close
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menu && !menu.contains(target) && !this._searchIcon?.contains(target)) {
        this._hidePositionMenu();
        document.removeEventListener('click', handleClickOutside);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
  }
  
  private _createPositionButton(menu: HTMLElement, position: 'left' | 'right', label: string): void {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = 'position-button';
    
    // Set active state
    if (position === this._iconPosition) {
      button.classList.add('active');
    }
    
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this._moveIconToPosition(position);
    });
    
    menu.appendChild(button);
  }
  
  private _moveIconToPosition(newPosition: 'left' | 'right'): void {
    if (newPosition === this._iconPosition) {
      this._hidePositionMenu();
      return;
    }
    
    console.log(`🔄 Moving search icon from ${this._iconPosition} to ${newPosition}`);
    
    this._iconPosition = newPosition;
    this._savePosition();
    
    // Update position classes
    this._updateIconPosition();
    
    // Update search container position
    this._updateSearchContainerPosition();
    
    // Sync with Distance Calculator navigation UI
    this._syncNavigationUIPosition(newPosition);
    
    // Hide menu after brief delay
    setTimeout(() => {
      this._hidePositionMenu();
    }, 400);
  }
  
  private _updateSearchContainerPosition(): void {
    const container = this._overlay?.querySelector('#expandable-search-container') as HTMLElement;
    if (container) {
      console.log(`🔄 Updating search container position to: ${this._iconPosition}`);
      
      // Remove previous position classes
      container.classList.remove('position-left', 'position-right');
      // Add new position class
      container.classList.add(`position-${this._iconPosition}`);
      
      console.log(`✅ Search container position updated`);
    }
  }
  
  private _hidePositionMenu(): void {
    if (!this._isShowingMenu || !this._positionMenu) return;
    
    this._isShowingMenu = false;
    
    // Animate out
    this._positionMenu.classList.remove('visible');
    
    // Reset icon visual state
    if (this._searchIcon) {
      this._searchIcon.classList.remove('menu-active');
    }
    
    // Remove menu after animation
    setTimeout(() => {
      if (this._positionMenu && this._overlay) {
        this._overlay.removeChild(this._positionMenu);
        this._positionMenu = null;
      }
    }, 250);
  }
  
  /**
   * Add a new destination programmatically
   */
  public addDestination(destination: Destination): void {
    this._destinations.push(destination);
    this._categories = [...new Set(this._destinations.map(d => d.category))];
    this._filterDestinations();
  }
  
  /**
   * Remove a destination programmatically
   */
  public removeDestination(destinationId: string): void {
    this._destinations = this._destinations.filter(d => d.id !== destinationId);
    this._categories = [...new Set(this._destinations.map(d => d.category))];
    this._filterDestinations();
  }
  
  /**
   * Get all destinations
   */
  public getDestinations(): Destination[] {
    return [...this._destinations];
  }
  
  /**
   * Get filtered destinations
   */
  public getFilteredDestinations(): Destination[] {
    return [...this._filteredDestinations];
  }
  
  private _syncNavigationUIPosition(side: 'left' | 'right'): void {
    try {
      const zcomp = this.getZComponentInstance();
      
      // Find the DistanceCalculator behavior
      const distanceCalculatorBehavior = Array.from(zcomp.entityByID.values()).find(entity => 
        (entity as any).constructor?.name === 'DistanceCalculator'
      );
      
      console.log(`🔗 Attempting to sync Distance Calculator UI to: ${side}`);
      console.log(`📍 Distance Calculator behavior found:`, !!distanceCalculatorBehavior);
      
      if (distanceCalculatorBehavior && typeof (distanceCalculatorBehavior as any).updateUIPosition === 'function') {
        (distanceCalculatorBehavior as any).updateUIPosition(side);
        console.log(`✅ Successfully synced navigation UI position to: ${side}`);
      } else {
        console.warn('❌ Distance Calculator behavior not found or updateUIPosition method missing');
        console.log('Available entity IDs:', Array.from(zcomp.entityByID.keys()));
      }
    } catch (error) {
      console.warn('Could not sync navigation UI position:', error);
    }
  }

  dispose() {
    // Reset gesture state and cancel timers
    this._resetGestureState();
    
    // Hide position menu if showing
    if (this._isShowingMenu) {
      this._hidePositionMenu();
    }
    
    // Clean up DOM elements
    if (this._overlay && this._overlay.parentNode) {
      const container = this._overlay.querySelector('#expandable-search-container');
      const icon = this._overlay.querySelector('#floating-search-icon');
      const menu = this._overlay.querySelector('#position-menu');
      
      if (container) {
        this._overlay.removeChild(container);
      }
      if (icon) {
        this._overlay.removeChild(icon);
      }
      if (menu) {
        this._overlay.removeChild(menu);
      }
    }
    
    // Clear references
    this._searchIcon = null;
    this._positionMenu = null;
    this._longPressTimer = null;
    window.removeEventListener(
  "selected-user-changed",
  this._onSelectedUserChanged
);

    return super.dispose();
  }
}

/* ============================================================
 INTERNAL RUNTIME DESTINATION MOVER (NO EXTRA FILE)
 =========================================================== */

import * as THREE from "three";
import PeopleSearchUI from "./PeopleSearchUi";

/**
 * Runtime helper to move poi → Destination safely
 * Lives in the SAME file as requested
 */
class RuntimeDestinationMover {
  private static _object: THREE.Object3D | null = null;

  static register(object: THREE.Object3D) {
    this._object = object;
    console.log("✅ RuntimeDestinationMover registered");
  }

  static moveTo(x: number, y: number, z: number) {
    if (!this._object) {
      console.warn("⚠️ Destination object not registered yet");
      return;
    }

    this._object.position.set(x, y, z);
    this._object.updateMatrixWorld(true);

    console.log("📍 Destination moved to:", x, y, z);
  }
}

// expose globally so UI can use it
(window as any).RuntimeDestinationMover = RuntimeDestinationMover;