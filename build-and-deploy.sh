#!/bin/bash
# ==============================================================================
# ✨🚀 Obsidian Slack Formatter - The Ultimate Build & Deploy Experience 🚀✨
# ==============================================================================
# Behold! A script crafted not just for function, but for sheer spectacle!
# Prepare your terminal for an unparalleled deployment experience.
# Version: 4.0.0 (Ultimate Edition - Best of Both Worlds)
# ==============================================================================

# --- Configuration Citadel ---
# ** IMPORTANT! Set your Obsidian vault plugin path here! **
PLUGIN_DIR="$HOME/Documents/Alex's Messy Mind/.obsidian/plugins/obsidian-slack-formatter"
PROJECT_DIR="$(pwd)"
MANIFEST="manifest.json"
MAIN_JS="main.js"
STYLES_CSS="styles.css"
LOG_FILE="slack_formatter_build_log_$(date +%Y%m%d_%H%M%S).log"

# --- The Palette of Power & Glyphs of Glory ---
# Colors (ANSI Escape Codes)
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
UNDERLINE='\033[4m'
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

# Icons for different operations
ICON_BUILD="🔨"
ICON_SUCCESS="✅"
ICON_ERROR="❌"
ICON_WARNING="⚠️"
ICON_INFO="ℹ️"
ICON_COPY="📋"
ICON_DEPLOY="🚀"
ICON_PACKAGE="📦"
ICON_CLEAN="🧹"
ICON_TEST="🧪"
ICON_DOCS="📚"

# Spinner animation characters
SPINNER="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

# --- Magnificent Banner Display ---
show_banner() {
    clear
    echo ""
    echo -e "${FG_BRIGHT_CYAN}${BOLD}"
    echo '   ██████╗ ██████╗ ███████╗██╗██████╗ ██╗ █████╗ ███╗   ██╗'
    echo '   ██╔═══██╗██╔══██╗██╔════╝██║██╔══██╗██║██╔══██╗████╗  ██║'
    echo '   ██║   ██║██████╔╝███████╗██║██║  ██║██║███████║██╔██╗ ██║'
    echo '   ██║   ██║██╔══██╗╚════██║██║██║  ██║██║██╔══██║██║╚██╗██║'
    echo '   ╚██████╔╝██████╔╝███████║██║██████╔╝██║██║  ██║██║ ╚████║'
    echo '    ╚═════╝ ╚═════╝ ╚══════╝╚═╝╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝'
    echo ""
    echo '   ███████╗██╗      █████╗  ██████╗██╗  ██╗'
    echo '   ██╔════╝██║     ██╔══██╗██╔════╝██║ ██╔╝'
    echo '   ███████╗██║     ███████║██║     █████╔╝ '
    echo '   ╚════██║██║     ██╔══██║██║     ██╔═██╗ '
    echo '   ███████║███████╗██║  ██║╚██████╗██║  ██╗'
    echo '   ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝'
    echo ""
    echo '   ███████╗ ██████╗ ██████╗ ███╗   ███╗ █████╗ ████████╗████████╗███████╗██████╗'
    echo '   ██╔════╝██╔═══██╗██╔══██╗████╗ ████║██╔══██╗╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗'
    echo '   █████╗  ██║   ██║██████╔╝██╔████╔██║███████║   ██║      ██║   █████╗  ██████╔╝'
    echo '   ██╔══╝  ██║   ██║██╔══██╗██║╚██╔╝██║██╔══██║   ██║      ██║   ██╔══╝  ██╔══██╗'
    echo '   ██║     ╚██████╔╝██║  ██║██║ ╚═╝ ██║██║  ██║   ██║      ██║   ███████╗██║  ██║'
    echo '   ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝'
    echo ""
    echo -e "  ${RESET}${FG_BRIGHT_WHITE}${BOLD}              OBSIDIAN SLACK FORMATTER - BUILD SYSTEM v4.0             ${RESET}${FG_BRIGHT_CYAN}"
    echo "               ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨                  "
    echo -e "${RESET}\n"
}

# Print a fancy section header
print_section() {
    local title="$1"
    local title_display_len=$(echo -n "$title" | wc -m)
    local inner_width=60
    local padding=$(( (inner_width - title_display_len) / 2 ))
    local extra_space=$(( (inner_width - title_display_len) % 2 ))
    padding=$(( padding > 0 ? padding : 0 ))
    local pad_str=$(printf "%${padding}s")
    local end_pad_str=$(printf "%$((padding + extra_space))s")
    local h_line_fill=$(printf '%*s' "$inner_width" '' | tr ' ' "${H_LINE}")

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
        local char_index=$(( i % ${#SPINNER} ))
        local char=${SPINNER:char_index:1}
        echo -n -e "\r${FG_YELLOW}${message}${RESET} ${BOLD}${FG_BRIGHT_YELLOW}${char}${RESET} "
        sleep $delay
        i=$((i + 1))
    done
    echo -e "\r${FG_YELLOW}${message}${RESET} ${BOLD}${FG_BRIGHT_GREEN}✓${RESET}   "
    tput cnorm # Restore cursor
}

# Enhanced logging functions
print_success() {
    echo -e "${ICON_SUCCESS} ${FG_BRIGHT_GREEN}${BOLD}$1${RESET}"
}

print_error() {
    echo -e "${ICON_ERROR} ${FG_BRIGHT_RED}${BOLD}ERROR:${RESET} $1"
}

print_warning() {
    echo -e "${ICON_WARNING} ${FG_BRIGHT_YELLOW}${BOLD}WARNING:${RESET} $1"
}

print_info() {
    echo -e "${ICON_INFO} ${FG_BRIGHT_BLUE}$1${RESET}"
}

# Directory operations
ensure_dir_exists() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        print_info "Creating directory: ${FG_BRIGHT_WHITE}${dir}${RESET}"
        mkdir -p "$dir" || {
            print_error "Failed to create directory: $dir"
            exit 1
        }
    fi
}

# Run command with spinner
run_with_spinner() {
    local cmd="$1"
    local message="$2"
    
    # Run command in background
    eval "$cmd" > /tmp/build_output 2>&1 &
    local pid=$!
    
    # Show spinner while command runs
    show_spinner $pid "$message"
    
    # Wait for command to complete and get exit code
    wait $pid
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        print_success "$message completed successfully"
    else
        print_error "$message failed (exit code: $exit_code)"
        echo "Output:"
        cat /tmp/build_output
        rm -f /tmp/build_output
        exit $exit_code
    fi
    
    rm -f /tmp/build_output
    return $exit_code
}

# Optional CI validation
run_ci_validation() {
    print_section "COMPREHENSIVE CI VALIDATION"
    
    print_info "${ICON_TEST} Running core functionality tests..."
    run_with_spinner "npm run test:core" "Core functionality tests"
    
    print_info "${ICON_DOCS} Validating documentation coverage..."
    run_with_spinner "npm run docs:check" "Documentation coverage validation"
    
    print_success "All CI validations passed! ${ICON_SUCCESS}"
}

# Build process
run_build() {
    print_section "PRODUCTION BUILD"
    
    print_info "${ICON_PACKAGE} Building production bundle..."
    run_with_spinner "npm run build" "Production build"
    
    print_success "Build completed successfully! ${ICON_SUCCESS}"
}

# Deploy to vault
deploy_to_vault() {
    print_section "VAULT DEPLOYMENT"
    
    print_info "${ICON_INFO} ${BOLD}Target Plugin Directory:${RESET} ${FG_BRIGHT_BLUE}${PLUGIN_DIR}${RESET}"
    
    # Ensure plugin directory exists
    ensure_dir_exists "$PLUGIN_DIR"
    
    print_info "${ICON_DEPLOY} Deploying artifacts to vault..."
    
    # Deploy main files
    print_info "  ${ICON_COPY} Deploying ${FG_BRIGHT_WHITE}${MAIN_JS}${RESET}..."
    cp -v "$MAIN_JS" "$PLUGIN_DIR/" || {
        print_error "Failed to copy $MAIN_JS"
        exit 1
    }
    
    print_info "  ${ICON_COPY} Deploying ${FG_BRIGHT_WHITE}${MANIFEST}${RESET}..."
    cp -v "$MANIFEST" "$PLUGIN_DIR/" || {
        print_error "Failed to copy $MANIFEST"
        exit 1
    }
    
    if [[ -f "$STYLES_CSS" ]]; then
        print_info "  ${ICON_COPY} Deploying ${FG_BRIGHT_WHITE}${STYLES_CSS}${RESET}..."
        cp -v "$STYLES_CSS" "$PLUGIN_DIR/" || {
            print_error "Failed to copy $STYLES_CSS"
            exit 1
        }
    fi
    
    print_success "Deployment completed successfully! ${ICON_SUCCESS}"
}

# Show final summary
show_summary() {
    local build_end_time=$(date +%s)
    local build_duration=$((build_end_time - build_start_time))
    
    echo ""
    echo -e "${FG_BRIGHT_BLUE}${TL_CORNER}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${TR_CORNER}${RESET}"
    echo -e "${FG_BRIGHT_BLUE}${V_LINE}${RESET}                         ${FG_BRIGHT_GREEN}${BOLD}🎉 BUILD COMPLETE! 🎉${RESET}                         ${FG_BRIGHT_BLUE}${V_LINE}${RESET}"
    echo -e "${FG_BRIGHT_BLUE}${V_LINE}${RESET}                                                                      ${FG_BRIGHT_BLUE}${V_LINE}${RESET}"
    echo -e "${FG_BRIGHT_BLUE}${V_LINE}${RESET} ${BOLD}Build Duration    :${RESET} ${FG_BRIGHT_YELLOW}${build_duration} seconds${RESET}                                    ${FG_BRIGHT_BLUE}${V_LINE}${RESET}"
    echo -e "${FG_BRIGHT_BLUE}${V_LINE}${RESET} ${BOLD}Deployed To       :${RESET} ${FG_BRIGHT_BLUE}${UNDERLINE}${PLUGIN_DIR}${RESET} ${FG_BRIGHT_BLUE}${V_LINE}${RESET}"
    echo -e "${FG_BRIGHT_BLUE}${V_LINE}${RESET} ${BOLD}Status            :${RESET} ${FG_BRIGHT_GREEN}Ready for Obsidian! ${ICON_SUCCESS}${RESET}                        ${FG_BRIGHT_BLUE}${V_LINE}${RESET}"
    echo -e "${FG_BRIGHT_BLUE}${V_LINE}${RESET}                                                                      ${FG_BRIGHT_BLUE}${V_LINE}${RESET}"
    echo -e "${FG_BRIGHT_BLUE}${V_LINE}${RESET}           ${FG_BRIGHT_MAGENTA}May your Slack pastes be beautifully formatted!${RESET}           ${FG_BRIGHT_BLUE}${V_LINE}${RESET}"
    echo -e "${FG_BRIGHT_BLUE}${BL_CORNER}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${BR_CORNER}${RESET}"
    echo ""
}

# Main execution
main() {
    local build_start_time=$(date +%s)
    
    # Show the magnificent banner
    show_banner
    
    # Check for command line arguments
    local skip_ci=false
    local skip_build=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-ci)
                skip_ci=true
                print_info "Skipping CI validation (--skip-ci flag)"
                shift
                ;;
            --skip-build)
                skip_build=true
                print_info "Skipping build step (--skip-build flag)"
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-ci      Skip CI validation tests"
                echo "  --skip-build   Skip build step (deploy existing files)"
                echo "  --help, -h     Show this help message"
                echo ""
                exit 0
                ;;
            *)
                print_warning "Unknown argument: $1"
                shift
                ;;
        esac
    done
    
    # Validate environment
    print_section "ENVIRONMENT VALIDATION"
    
    print_info "Checking Node.js and npm..."
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed or not in PATH"
        exit 1
    fi
    print_success "Node.js and npm are available"
    
    print_info "Installing dependencies..."
    run_with_spinner "npm install" "Dependency installation"
    
    # Optional CI validation
    if [[ "$skip_ci" == "false" ]]; then
        run_ci_validation
    else
        print_warning "Skipping CI validation"
    fi
    
    # Build step
    if [[ "$skip_build" == "false" ]]; then
        run_build
    else
        print_warning "Skipping build step"
    fi
    
    # Deploy to vault
    deploy_to_vault
    
    # Show final summary
    show_summary
    
    print_success "🚀 Obsidian Slack Formatter is ready to use! 🚀"
}

# Trap to ensure cursor is restored on exit
trap 'tput cnorm' EXIT

# Let the magic begin!
main "$@"