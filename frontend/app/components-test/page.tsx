import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function ComponentsTestPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <h1 className="text-4xl font-bold">shadcn/ui Components Test</h1>

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Various button styles and sizes</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>Badge variants</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Input</CardTitle>
          <CardDescription>Text input field</CardDescription>
        </CardHeader>
        <CardContent>
          <Input type="text" placeholder="Enter text here..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabs</CardTitle>
          <CardDescription>Tab navigation</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tab1">
            <TabsList>
              <TabsTrigger value="tab1">Tab 1</TabsTrigger>
              <TabsTrigger value="tab2">Tab 2</TabsTrigger>
              <TabsTrigger value="tab3">Tab 3</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">
              <p className="text-sm text-gray-600">Content for Tab 1</p>
            </TabsContent>
            <TabsContent value="tab2">
              <p className="text-sm text-gray-600">Content for Tab 2</p>
            </TabsContent>
            <TabsContent value="tab3">
              <p className="text-sm text-gray-600">Content for Tab 3</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Table</CardTitle>
          <CardDescription>Data table example</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Gibson Les Paul</TableCell>
                <TableCell><Badge>Available</Badge></TableCell>
                <TableCell className="text-right">$2,499</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Fender Stratocaster</TableCell>
                <TableCell><Badge variant="secondary">Sold</Badge></TableCell>
                <TableCell className="text-right">$1,299</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">PRS Custom 24</TableCell>
                <TableCell><Badge>Available</Badge></TableCell>
                <TableCell className="text-right">$3,199</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
