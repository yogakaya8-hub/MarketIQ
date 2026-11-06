import { Link } from 'react-router-dom';
import { Empty } from '../../components/ui';
import { PackageSearch } from 'lucide-react';

export default function NotFound() {
  return <Empty icon={PackageSearch} title="Page not found" action={<Link to="/" className="btn-primary">Go to the home page</Link>}>The link may be broken or the page may have moved.</Empty>;
}
