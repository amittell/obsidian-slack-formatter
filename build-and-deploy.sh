#!/bin/bash
# ==============================================================================
# ✨🚀 Obsidian Slack Formatter - The Most Glorious Build & Deploy Script 🚀✨
# ==============================================================================
# Behold! A script crafted not just for function, but for sheer spectacle!
# Prepare your terminal for an unparalleled deployment experience.
# Version: 3.1.1 (Ultimate Fancy Edition - Corrected)
# ==============================================================================

# --- Configuration Citadel ---
# ** IMPORTANT PILOT! Set your Obsidian vault plugin constellation here! **
PLUGIN_DIR="$HOME/Documents/Alex's Messy Mind/.obsidian/plugins/obsidian-slack-formatter" # <-- CORRECT Slack Formatter PATH
PROJECT_DIR="$(pwd)" # The sacred ground from whence we build!
MANIFEST="manifest.json"
MAIN_JS="main.js"
STYLES_CSS="styles.css"
LOG_FILE="slack_formatter_build_log_$(date +%Y%m%d_%H%M%S).log" # <-- Specific Log File Name

# --- The Palette of Power & Glyphs of Glory ---
# Colors (ANSI Escape Codes)
RESET='\033[0m' # No Color / Reset
BOLD='\033[1m'
DIM='\033[2m'
UNDERLINE='\033[4m'
# BLINK='\033[5m' # Avoid blink
FG_BLACK='\033[0;30m'
FG_RED='\033[0;31m'
FG_GREEN='\033[0;32m'
FG_YELLOW='\033[0;33m'
FG_BLUE='\033[0;34m'
FG_MAGENTA='\033[0;35m'
FG_CYAN='\033[0;36m'
FG_WHITE='\033[0;37m'
FG_BRIGHT_BLACK='\033[1;30m'
FG_BRIGHT_RED='\033[1;31m'
FG_BRIGHT_GREEN='\033[1;32m'
FG_BRIGHT_YELLOW='\033[1;33m'
FG_BRIGHT_BLUE='\033[1;34m'
FG_BRIGHT_MAGENTA='\033[1;35m'
FG_BRIGHT_CYAN='\033[1;36m'
FG_BRIGHT_WHITE='\033[1;37m'
BG_RED='\033[0;41m'
BG_GREEN='\033[0;42m'
BG_YELLOW='\033[0;43m'

# Box drawing characters
H_LINE="━"
V_LINE="┃"
TL_CORNER="┏"
TR_CORNER="┓"
BL_CORNER="┗"
BR_CORNER="┛"
T_DOWN="┳"
T_UP="┻"
T_RIGHT="┣"
T_LEFT="┫"
CROSS="╋"

# Spinner array
SPINNER=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

# Icons (Adapted from both scripts)
ICON_CLEAN="💨"
ICON_INSTALL="💾"
ICON_BUILD="🛠️ "
ICON_FOLDER="📂"
ICON_COPY="✨"
ICON_ROCKET="🚀" # Using original rocket
ICON_CHECK="🏆" # Trophy for success
ICON_CROSS="🔥" # Fire for error
ICON_INFO="💡"
ICON_WARN="⚡"
ICON_PARTY="🥳"
ICON_STAR="🌟"
ICON_CLOCK="⏱️"
ICON_FILE="📄"

# --- Arcane Scrolls (Helper Functions) ---

# Print fancy header (Corrected for Slack Formatter)
print_main_header() {
    clear
    echo -e "${CYAN}"
    echo '    ██████╗ ██████╗ ███████╗██╗██████╗  █████╗ ███╗   ██╗'
    echo '   ██╔═══██╗██╔══██╗██╔════╝██║██╔══██╗██╔══██╗████╗  ██║'
    echo '   ██║   ██║██████╔╝███████╗██║██║  ██║███████║██╔██╗ ██║'
    echo '   ██║   ██║██╔══██╗╚════██║██║██║  ██║██╔══██║██║╚██╗██║'
    echo '   ╚██████╔╝██████╔╝███████║██║██████╔╝██║  ██║██║ ╚████║'
    echo '    ╚═════╝ ╚═════╝ ╚══════╝╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝'
    echo ''
    echo '   ███████╗██╗      █████╗  ██████╗██╗  ██╗'
    echo '   ██╔════╝██║     ██╔══██╗██╔════╝██║ ██╔╝'
    echo '   ███████╗██║     ███████║██║     █████╔╝ '
    echo '   ╚════██║██║     ██╔══██║██║     ██╔═██╗ '
    echo '   ███████║███████╗██║  ██║╚██████╗██║  ██╗'
    echo '   ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝'
    echo ''
    echo '   ███████╗ ██████╗ ███████╗███╗   ███╗ █████╗ ████████╗████████╗███████╗███████╗'
    echo '   ██╔════╝██╔═══██╗██╔══██╗████╗ ████║██╔══██╗╚══██╔══╝╚══██╔══╝██╔════╝██╔══██║'
    echo '   ███████╗██║   ██║██████╔╝██╔████╔██║███████║   ██║      ██║   ███████╗██████╔╝'
    echo '   ██╔════╝██║   ██║██╔══██╗██║╚██╔╝██║██╔══██║   ██║      ██║   ██╔════╝██╔══██╗'
    echo '   ██║     ╚██████╔╝██║  ██║██║ ╚═╝ ██║██║  ██║   ██║      ██║   ███████║██║  ██║'
    echo '   ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝'
    echo ""
    echo "  ${RESET}${WHITE}${BOLD}              OBSIDIAN SLACK FORMATTER - BUILD SYSTEM v3.1             ${RESET}${CYAN}" # Adjusted Title & Version
    echo "               ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨                  "
    echo -e "${RESET}\n"
}

# Print a fancy section header
print_section() {
    local title="$1"
    # Calculate padding for centering the title within a 64-char width (including borders/icons)
    local title_display_len=$(echo -n "$title" | wc -m)
    local inner_width=60
    local padding=$(( (inner_width - title_display_len) / 2 ))
    local extra_space=$(( (inner_width - title_display_len) % 2 ))
    padding=$(( padding > 0 ? padding : 0 )) # Ensure padding is not negative
    local pad_str=$(printf "%${padding}s")
    local end_pad_str=$(printf "%$((padding + extra_space))s")
    local h_line_fill=$(printf '%*s' "$inner_width" '' | tr ' ' "${H_LINE}") # Corrected line drawing

    echo ""
    echo -e "${FG_BRIGHT_BLUE}${TL_CORNER}${H_LINE}${H_LINE}${H_LINE}${H_LINE}${H_LINE}${T_DOWN}${h_line_fill}${T_DOWN}${H_LINE}${H_LINE}${H_LINE}${H_LINE}${H_LINE}${TR_CORNER}${RESET}"
    echo -e "${FG_BRIGHT_BLUE}${V_LINE}${RESET} ${FG_BRIGHT_MAGENTA}${BOLD}⚙️ ${RESET} ${FG_BRIGHT_BLUE}${V_LINE}${RESET}${pad_str}${FG_BRIGHT_YELLOW}${BOLD}${title}${RESET}${end_pad_str}${FG_BRIGHT_BLUE}${V_LINE}${RESET} ${FG_BRIGHT_MAGENTA}${BOLD}⚙️ ${RESET} ${FG_BRIGHT_BLUE}${V_LINE}${RESET}"
    echo -e "${FG_BRIGHT_BLUE}${BL_CORNER}${H_LINE}${H_LINE}${H_LINE}${H_LINE}${H_LINE}${T_UP}${h_line_fill}${T_UP}${H_LINE}${H_LINE}${H_LINE}${H_LINE}${H_LINE}${BR_CORNER}${RESET}"
}

# Show animated spinner
show_spinner() {
    local pid=$1
    local message=$2
    local delay=0.1
    local i=0
    tput civis # Hide cursor
    echo -n -e "${FG_YELLOW}${message}${RESET} "
    while ps -p $pid > /dev/null; do
        local char_index=$(( i % ${#SPINNER[@]} ))
        local char=${SPINNER:char_index:1}
        # Use \r to return cursor to beginning of line, then print spinner and space to overwrite
        echo -n -e "\r${FG_YELLOW}${message}${RESET} ${BOLD}${FG_BRIGHT_YELLOW}${char}${RESET} "
        sleep $delay
        i=$((i + 1))
    done
    # Clear the line after spinner finishes
    echo -e "\r${FG_YELLOW}${message}${RESET} ${BOLD}${FG_BRIGHT_GREEN}✓${RESET}   "
    tput cnorm # Restore cursor
}

# Check command status
check_status() {
    local status=$?
    local task_name=$1
    local spinner_pid=$2

    # Kill the spinner if it's running and was provided
    if [[ -n "$spinner_pid" && $(ps -p $spinner_pid -o comm=) ]]; then
        kill $spinner_pid > /dev/null 2>&1
        wait $spinner_pid > /dev/null 2>&1
        tput cnorm # Ensure cursor is visible
        # Clear the spinner line one last time before printing status
        echo -e "\r\033[K"
    fi

    if [ $status -ne 0 ]; then
        printf "${BOLD}${BG_RED}${FG_BRIGHT_WHITE} ${ICON_CROSS} FAILURE! ${RESET} ${FG_BRIGHT_RED}Error during: ${UNDERLINE}${task_name}${RESET}${FG_BRIGHT_RED}. Aborting!${RESET}\n"
        echo -e "${FG_RED}Check log file for details: ${LOG_FILE}${RESET}"
        exit 1
    else
        # If spinner was used, the success checkmark is already printed by show_spinner's end state
        # Otherwise, print a standard success message
        if [[ -z "$spinner_pid" ]]; then
             printf "${BOLD}${FG_BRIGHT_GREEN}${ICON_CHECK} Success:${RESET} ${FG_GREEN}${task_name} completed.${RESET}\n"
        fi
    fi
}

# Ensure directory exists
ensure_dir_exists() {
    if [ ! -d "$1" ]; then
        print_info "${ICON_FOLDER} Creating target directory: ${DIM}$1${RESET}"
        mkdir -p "$1"
        check_status "Directory creation ($1)"
    else
        print_info "${ICON_FOLDER} Target directory exists: ${DIM}$1${RESET}"
    fi
}

# Print timing info
print_timing() {
    local label="$1"
    local start_time="$2"
    local end_time="$3"
    local duration=$(echo "$end_time - $start_time" | bc)
    local formatted=$(printf "%.4f" $duration)
    echo -e "${FG_CYAN}${ICON_CLOCK} ${label}: ${formatted} seconds${RESET}"
}

# Print success message (Added from inspiration)
print_success() {
    local message="$1"
    echo -e "${GREEN}${BOLD}✅ ${message}${RESET}"
}

# Print error message (Added from inspiration)
print_error() {
    local message="$1"
    echo -e "${RED}${BOLD}❌ ${message}${RESET}" >&2
}

# Print warning message (Added from inspiration)
print_warning() {
    local message="$1"
    echo -e "${YELLOW}${BOLD}⚠️  ${message}${RESET}"
}

# Print info message (Added from inspiration)
print_info() {
    local message="$1"
    echo -e "${BLUE}${BOLD}ℹ️  ${message}${RESET}"
}


# Print final summary
print_summary() {
    local end_time=$(date +%s.%N)
    local total_duration=$(echo "$end_time - $START_TIME" | bc)
    local formatted_duration=$(printf "%.2f" $total_duration)

    echo ""
    echo -e "${FG_BRIGHT_BLUE}╭──────────────────────────────────────────────────────────────────╮${RESET}" # Adjusted width
    echo -e "${FG_BRIGHT_BLUE}│${RESET}${FG_BRIGHT_CYAN}${BOLD}              🚀 BUILD & DEPLOY SUMMARY 🚀                 ${RESET}${FG_BRIGHT_BLUE}│${RESET}"
    echo -e "${FG_BRIGHT_BLUE}├──────────────────────────────────────────────────────────────────┤${RESET}"
    echo -e "${FG_BRIGHT_BLUE}│${RESET} ${BOLD}Plugin Name       :${RESET} ${FG_WHITE}Obsidian Slack Formatter${RESET}             ${FG_BRIGHT_BLUE}│${RESET}"
    echo -e "${FG_BRIGHT_BLUE}│${RESET} ${BOLD}Total Build Time  :${RESET} ${FG_BRIGHT_GREEN}${formatted_duration} seconds${RESET}                       ${FG_BRIGHT_BLUE}│${RESET}"
    echo -e "${FG_BRIGHT_BLUE}│${RESET} ${BOLD}Completion Time   :${RESET} ${FG_BRIGHT_GREEN}$(date '+%H:%M:%S')${RESET}                           ${FG_BRIGHT_BLUE}│${RESET}"
    echo -e "${FG_BRIGHT_BLUE}│${RESET} ${BOLD}Log File          :${RESET} ${FG_CYAN}${LOG_FILE}${RESET}        ${FG_BRIGHT_BLUE}│${RESET}" # Adjusted spacing
    echo -e "${FG_BRIGHT_BLUE}│${RESET} ${BOLD}Deployed To       :${RESET} ${FG_BRIGHT_BLUE}${UNDERLINE}${PLUGIN_DIR}${RESET} ${FG_BRIGHT_BLUE}│${RESET}"
    echo -e "${FG_BRIGHT_BLUE}│${RESET}                                                            ${FG_BRIGHT_BLUE}│${RESET}"
    echo -e "${FG_BRIGHT_BLUE}│${RESET} ${FG_BRIGHT_YELLOW}${BOLD}${ICON_STAR} Deployment sequence complete! Engage Obsidian! ${ICON_STAR}${RESET}      ${FG_BRIGHT_BLUE}│${RESET}"
    echo -e "${FG_BRIGHT_BLUE}╰──────────────────────────────────────────────────────────────────╯${RESET}"
    echo ""
    echo -e "${FG_BRIGHT_MAGENTA}${BOLD}✨ May your Slack pastes be beautifully formatted! ✨${RESET}"
    echo ""
}

# Handle script errors
handle_error() {
    tput cnorm # Ensure cursor is visible if error occurs during spinner
    echo ""
    print_error "Build failed! Check the log file: $LOG_FILE"
    exit 1
}

# --- The Grand Orchestration (Main Script) ---

# Start logging
exec > >(tee -a "$LOG_FILE") 2>&1

# Set up error handling
trap handle_error ERR

# Showtime!
print_main_header
START_TIME=$(date +%s.%N)

print_info "${ICON_INFO} ${BOLD}Target Plugin Directory:${RESET} ${FG_BRIGHT_BLUE}${PLUGIN_DIR}${RESET}"
print_info "${ICON_INFO} ${BOLD}Project Directory:${RESET}       ${FG_BRIGHT_BLUE}${PROJECT_DIR}${RESET}"

# Navigate to project directory
print_info "Navigating to project directory..."
cd "$PROJECT_DIR" || { print_error "Cannot navigate to project directory ${PROJECT_DIR}"; exit 1; }
check_status "Navigation to project directory" # Use check_status here

# --- Phase 1: Purification Ritual ---
print_section "PHASE 1: DEPENDENCY PURIFICATION"
phase1_start_time=$(date +%s.%N)

print_info "${ICON_CLEAN} Purging old node_modules and package-lock.json..."
rm -rf node_modules package-lock.json &> /dev/null
check_status "Purge complete"

print_info "${ICON_INSTALL} Installing fresh dependencies via npm (this may take a moment)..."
npm install --loglevel=error # Run in foreground, remove spinner, restore loglevel
# install_pid=$! # Removed PID capture
# show_spinner $install_pid "Conjuring dependencies..." # Removed spinner
check_status "Dependency installation" # Removed PID from check_status

phase1_end_time=$(date +%s.%N)
print_timing "Phase 1 duration" $phase1_start_time $phase1_end_time

# --- Phase 2: The Great Construction ---
print_section "PHASE 2: ARTIFACT CONSTRUCTION"
phase2_start_time=$(date +%s.%N)

print_info "${ICON_BUILD} Initiating project build (npm run build)..."
(npm run build) &
build_pid=$!
show_spinner $build_pid "Compiling and bundling..."
check_status "Project build" $build_pid

phase2_end_time=$(date +%s.%N)
print_timing "Phase 2 duration" $phase2_start_time $phase2_end_time

# --- Phase 3: Build Analysis ---
print_section "PHASE 3: BUILD ANALYSIS"
phase3_start_time=$(date +%s.%N)

print_info "${ICON_INFO} Running build analysis (npm run analyze)..."
# Run the analysis script directly using node, assuming it's executable
# No spinner here as the output is the analysis itself
node scripts/optimize-build.js
check_status "Build analysis"

phase3_end_time=$(date +%s.%N)
print_timing "Phase 3 duration" $phase3_start_time $phase3_end_time

# --- Phase 4: Dimensional Gateway Preparation ---
print_section "PHASE 4: TARGET DIMENSION PREPARATION"
phase4_start_time=$(date +%s.%N)
ensure_dir_exists "$PLUGIN_DIR"
phase4_end_time=$(date +%s.%N)
print_timing "Phase 4 duration" $phase4_start_time $phase4_end_time

# --- Phase 4: Artifact Translocation ---
print_section "PHASE 5: DEPLOYMENT"
phase5_start_time=$(date +%s.%N)

print_info "${ICON_COPY} Deploying artifacts to ${DIM}${PLUGIN_DIR}${RESET}"

print_info "  ${ICON_COPY} Preparing to deploy ${FG_BRIGHT_WHITE}${MAIN_JS}${RESET}..."
cp -v "$MAIN_JS" "$PLUGIN_DIR/" # Added -v flag for verbose copy
check_status "Deployment of ${MAIN_JS}"

print_info "  ${ICON_COPY} Preparing to deploy ${FG_BRIGHT_WHITE}${MANIFEST}${RESET}..."
cp -v "$MANIFEST" "$PLUGIN_DIR/" # Added -v flag for verbose copy
check_status "Deployment of ${MANIFEST}"

print_info "  ${ICON_COPY} Preparing to deploy ${FG_BRIGHT_WHITE}${STYLES_CSS}${RESET}..."
cp -v "$STYLES_CSS" "$PLUGIN_DIR/" # Added -v flag for verbose copy
check_status "Deployment of ${STYLES_CSS}"

phase5_end_time=$(date +%s.%N)
print_timing "Phase 5 duration" $phase5_start_time $phase5_end_time

# --- The Grand Finale ---
print_summary

# Final reminder
echo -e "\n${BOLD}${FG_BRIGHT_YELLOW}${ICON_WARN} Reminder:${RESET}${FG_YELLOW} Restart Obsidian or reload the plugin ('Reload app without saving' command) to apply changes.${RESET}\n"

exit 0
