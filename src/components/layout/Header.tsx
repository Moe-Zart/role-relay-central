import { Search } from "lucide-react";
import { Link } from "react-router-dom";

export const Header = () => {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <div className="p-2 bg-primary rounded-lg">
            <Search className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">JobNavigator</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">All Your Job Boards in One Place</p>
          </div>
        </Link>
        
        <nav className="hidden md:flex items-center space-x-6">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            Search
          </Link>
          <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">
            About
          </Link>
          <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
            Terms
          </Link>
        </nav>
      </div>
    </header>
  );
};