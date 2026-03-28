#!/bin/bash

# CMI NaaP AI Network Intelligence Platform - Setup Script
# One-command installation and demo execution for all 6 projects

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
PROJECTS_SUCCESS=0
PROJECTS_FAILED=0
DEMO_SUCCESS=0
DEMO_FAILED=0

# Configuration
PYTHON_MIN_VERSION="3.10"
VENV_DIR="venv"
LOG_DIR="logs"
DATA_DIR="data"
MODELS_DIR="models"

# Logging functions
print_header() {
    echo -e "${CYAN}=====================================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}=====================================================================${NC}"
}

print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Main header
print_header "CMI NaaP AI Network Intelligence Platform - Setup"

# Check Python version
print_section "Checking Python Version"
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 not found. Please install Python 3.10 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
print_info "Python version: $PYTHON_VERSION"

if [ "$(printf '%s\n' "$PYTHON_MIN_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$PYTHON_MIN_VERSION" ]; then
    print_error "Python $PYTHON_MIN_VERSION or higher required (found $PYTHON_VERSION)"
    exit 1
fi
print_success "Python version meets requirements"

# Create directory structure
print_section "Creating Directory Structure"
mkdir -p "$LOG_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$MODELS_DIR"
mkdir -p "$LOG_DIR/projects"
for i in {1..6}; do
    mkdir -p "$LOG_DIR/project-$(printf "%02d" $i)"
done
print_success "Directory structure created"

# Create or activate virtual environment
print_section "Setting up Virtual Environment"
if [ ! -d "$VENV_DIR" ]; then
    print_info "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    print_success "Virtual environment created"
else
    print_info "Virtual environment already exists"
fi

# Activate virtual environment
print_info "Activating virtual environment..."
source "$VENV_DIR/bin/activate"
print_success "Virtual environment activated"

# Upgrade pip
print_info "Upgrading pip..."
python3 -m pip install --upgrade pip setuptools wheel > /dev/null 2>&1
print_success "pip upgraded"

# Install unified requirements
print_section "Installing Dependencies"
print_info "Installing unified platform requirements..."
if pip install -r requirements.txt > "$LOG_DIR/pip_install.log" 2>&1; then
    print_success "Unified requirements installed"
else
    print_error "Failed to install requirements. Check $LOG_DIR/pip_install.log"
    exit 1
fi

# Install project-specific requirements
print_section "Installing Project-Specific Dependencies"
PROJECTS=(
    "01_Blast_Radius_Analysis"
    "02_Autonomous_Operations_Agent"
    "03_Self_Healing_Network"
    "04_Predictive_Capacity_Intelligence"
    "05_Incident_Correlation_RCA"
    "06_Network_Knowledge_Assistant"
)

for i in "${!PROJECTS[@]}"; do
    project="${PROJECTS[$i]}"
    project_num=$((i + 1))
    project_log="$LOG_DIR/project-$(printf "%02d" $project_num)-install.log"

    if [ -f "$project/requirements.txt" ]; then
        print_info "Installing $project requirements..."
        if pip install -r "$project/requirements.txt" > "$project_log" 2>&1; then
            print_success "Project $(printf "%02d" $project_num) - $project"
        else
            print_error "Failed to install Project $(printf "%02d" $project_num). Check $project_log"
            PROJECTS_FAILED=$((PROJECTS_FAILED + 1))
            continue
        fi
        PROJECTS_SUCCESS=$((PROJECTS_SUCCESS + 1))
    else
        print_warning "Project $(printf "%02d" $project_num) - No requirements.txt found"
    fi
done

# Summary of installation
print_section "Installation Summary"
print_success "Successfully installed: $PROJECTS_SUCCESS projects"
if [ $PROJECTS_FAILED -gt 0 ]; then
    print_error "Failed installations: $PROJECTS_FAILED"
fi

# Run demos
print_section "Running Project Demonstrations"
print_info "This will execute interactive demos for all 6 projects sequentially..."
print_warning "You can interrupt any demo by pressing Ctrl+C"

for i in "${!PROJECTS[@]}"; do
    project="${PROJECTS[$i]}"
    project_num=$((i + 1))
    demo_log="$LOG_DIR/project-$(printf "%02d" $project_num)-demo.log"

    print_section "Project $(printf "%02d" $project_num): $project"

    if [ ! -f "$project/demo.py" ]; then
        print_warning "Demo file not found for Project $project_num"
        DEMO_FAILED=$((DEMO_FAILED + 1))
        continue
    fi

    print_info "Running demo (output saved to $demo_log)..."
    cd "$project"

    if python demo.py > "$demo_log" 2>&1; then
        print_success "Demo completed successfully"
        DEMO_SUCCESS=$((DEMO_SUCCESS + 1))
    else
        print_warning "Demo completed with warnings/errors"
        print_info "Check $demo_log for details"
        DEMO_FAILED=$((DEMO_FAILED + 1))
    fi

    cd - > /dev/null
done

# Setup status summary
print_section "Setup Complete - Summary Report"
echo -e "${CYAN}=====================================================
Platform: CMI NaaP AI Network Intelligence
Version:  1.0.0
Status:   Production Ready
=====================================================${NC}"

echo -e "\n${GREEN}✓ Installation Summary:${NC}"
echo "  • Projects installed successfully: $PROJECTS_SUCCESS/6"
echo "  • Projects with failures: $PROJECTS_FAILED/6"
echo "  • Demos completed successfully: $DEMO_SUCCESS/6"
echo "  • Demos with issues: $DEMO_FAILED/6"

echo -e "\n${CYAN}📁 Directory Structure:${NC}"
echo "  • Virtual environment: $VENV_DIR/"
echo "  • Log files: $LOG_DIR/"
echo "  • Data storage: $DATA_DIR/"
echo "  • Model cache: $MODELS_DIR/"

echo -e "\n${CYAN}🚀 Quick Start Commands:${NC}"
echo "  • Activate venv: source $VENV_DIR/bin/activate"
echo "  • Run project: cd <project-dir> && python main.py"
echo "  • Run demo: cd <project-dir> && python demo.py"
echo "  • Docker Compose: docker-compose up -d"
echo "  • Kubernetes: kubectl apply -f kubernetes/"

echo -e "\n${CYAN}📊 Access Points:${NC}"
echo "  • Master Dashboard: http://localhost:8000"
echo "  • Project 01 (Blast Radius): http://localhost:8001"
echo "  • Project 02 (Autonomous Ops): http://localhost:8002"
echo "  • Project 03 (Self-Healing): http://localhost:8003"
echo "  • Project 04 (Predictive): http://localhost:8004"
echo "  • Project 05 (Incident Corr): http://localhost:8005"
echo "  • Project 06 (Knowledge AI): http://localhost:8006"

echo -e "\n${CYAN}📚 Next Steps:${NC}"
echo "  1. Review project-specific READMEs in each directory"
echo "  2. Check logs for any warnings or errors"
echo "  3. Start with 'docker-compose up -d' for full platform"
echo "  4. Or run individual projects with 'python main.py'"
echo "  5. Access master dashboard at http://localhost:8000"

# Check for any critical issues
if [ $PROJECTS_SUCCESS -eq 6 ] && [ $DEMO_SUCCESS -eq 6 ]; then
    echo -e "\n${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✓ ALL SYSTEMS OPERATIONAL - READY FOR DEPLOYMENT${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    exit 0
elif [ $PROJECTS_SUCCESS -ge 4 ]; then
    echo -e "\n${YELLOW}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}⚠ PARTIAL SUCCESS - Some projects failed, review logs${NC}"
    echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
    exit 1
else
    echo -e "\n${RED}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}✗ SETUP FAILED - Multiple projects could not be installed${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
    exit 2
fi
